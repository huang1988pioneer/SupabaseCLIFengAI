import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/args.js';
import { parseCsv, parseCsvObjects, toCsv } from '../src/csv.js';
import { daysUntil, formatDays, formatMoney, parseDateInput, parseBool, isValidDate } from '../src/util.js';
import { strWidth, truncate, pad, setColor, table } from '../src/ui.js';
import { findModule, fieldOf, bankKind, MODULES } from '../src/modules.js';
import { convertField, diffPatch, rowToPayload, matchSearch } from '../src/commands/records.js';
import { subscriptionAlerts, foodAlerts } from '../src/commands/overview.js';
import { SupabaseClient } from '../src/supabase.js';

setColor(false);
const NOW = new Date(2026, 8, 25, 10, 0, 0); // 2026-09-25 本地時間

test('parseArgs: 位置參數、長短旗標、--no-、負數值', () => {
  const { positional, flags } = parseArgs(['sub', 'add', 'Netflix', '--price', '390', '--nextdate=+1m', '-n', '5', '--no-iscontinue', '--json', '--amount', '-3']);
  assert.deepEqual(positional, ['sub', 'add', 'Netflix']);
  assert.equal(flags.price, '390');
  assert.equal(flags.nextdate, '+1m');
  assert.equal(flags.limit, '5');
  assert.equal(flags.iscontinue, false);
  assert.equal(flags.json, true);
  assert.equal(flags.amount, '-3');
});

test('parseArgs: 布林旗標不吃掉後面的位置參數；--no-color → color=false', () => {
  const { positional, flags } = parseArgs(['food', '--json', 'list', '--no-color', '-y']);
  assert.deepEqual(positional, ['food', 'list']);
  assert.equal(flags.color, false);
  assert.equal(flags.yes, true);
});

test('CSV：引號、逗號、換行與 BOM 來回轉換', () => {
  const rows = [{ name: '牛奶, 全脂', note: '第一行\n第二行 "引號"', amount: 2 }];
  const csv = toCsv(['name', 'note', 'amount'], rows);
  assert.ok(csv.startsWith('﻿'));
  const back = parseCsvObjects(csv);
  assert.deepEqual(back, [{ name: '牛奶, 全脂', note: '第一行\n第二行 "引號"', amount: '2' }]);
  assert.deepEqual(parseCsv('a,b\r\n1,2\r\n\r\n'), [['a', 'b'], ['1', '2']]);
});

test('日期：相對日期、驗證與剩餘天數', () => {
  assert.equal(parseDateInput('today', NOW), '2026-09-25');
  assert.equal(parseDateInput('+7', NOW), '2026-10-02');
  assert.equal(parseDateInput('-1w', NOW), '2026-09-18');
  assert.equal(parseDateInput('+1m', NOW), '2026-10-25');
  assert.equal(parseDateInput('2026/1/5', NOW), '2026-01-05');
  assert.throws(() => parseDateInput('2026-02-30', NOW));
  assert.equal(isValidDate('2028-02-29'), true);
  assert.equal(daysUntil('2026-09-28', NOW), 3);
  assert.equal(daysUntil('2026-09-22T00:00:00+00:00', NOW), -3);
  assert.equal(formatDays(-3), '已過期 3 天');
  assert.equal(formatDays(0), '今天');
});

test('金額：外幣換算成台幣（與網頁版匯率相同）', () => {
  assert.equal(formatMoney(390), 'NT$ 390');
  assert.equal(formatMoney(10, 'USD'), 'NT$ 350 ($ 10)');
  assert.equal(formatMoney(1000, 'JPY'), 'NT$ 350 (¥ 1,000)');
  assert.equal(formatMoney(null), '');
});

test('parseBool', () => {
  assert.equal(parseBool('yes'), true);
  assert.equal(parseBool('否'), false);
  assert.throws(() => parseBool('maybe'));
});

test('CJK 寬度、截斷與對齊', () => {
  assert.equal(strWidth('鋒兄abc'), 7);
  assert.equal(truncate('鋒兄AI Supabase', 6), '鋒兄A…');
  assert.equal(pad('食品', 6), '食品  ');
  assert.equal(pad('12', 4, 'right'), '  12');
  const out = table([{ a: '訂閱', b: 1 }], [{ key: 'a', label: '名稱' }, { key: 'b', label: '數', align: 'right' }]);
  assert.equal(out.split('\n')[2], '訂閱   1');
});

test('模組：別名、欄位與網頁版資料表對應', () => {
  assert.equal(findModule('sub').table, 'subscription');
  assert.equal(findModule('訂閱').id, 'subscription');
  assert.equal(findModule('trial').table, 'trialpurchase');
  assert.equal(findModule('note').table, 'article');
  assert.equal(findModule('gallery').table, 'image');
  assert.equal(findModule('shopping').table, 'shoppinglist');
  assert.equal(findModule('xyz'), null);
  assert.equal(new Set(MODULES.map((m) => m.id)).size, MODULES.length);
  assert.equal(fieldOf(findModule('common'), 'site37').label, '網站37');
});

test('convertField：型別轉換與驗證', () => {
  const sub = findModule('subscription');
  assert.equal(convertField(fieldOf(sub, 'price'), '1,200'), 1200);
  assert.throws(() => convertField(fieldOf(sub, 'price'), '1.5'));
  assert.equal(convertField(fieldOf(sub, 'currency'), 'usd'), 'USD');
  assert.equal(convertField(fieldOf(sub, 'currency'), '日圓'), 'JPY');
  assert.throws(() => convertField(fieldOf(sub, 'currency'), 'EUR'));
  assert.equal(convertField(fieldOf(sub, 'iscontinue'), true), true);
  assert.equal(convertField(fieldOf(sub, 'note'), ''), null);
  assert.throws(() => convertField(fieldOf(sub, 'name'), 'x'.repeat(101)));
  assert.throws(() => convertField(fieldOf(sub, 'price'), true));
});

test('rowToPayload 忽略系統欄位；diffPatch 只保留差異', () => {
  const food = findModule('food');
  const payload = rowToPayload(food, { id: 'x', $id: 'y', name: '牛奶', amount: '2', todate: '2026-10-01', unknown: 'z' });
  assert.deepEqual(payload, { name: '牛奶', amount: 2, todate: '2026-10-01' });
  const row = { name: '牛奶', amount: 2, todate: '2026-10-01', shop: null };
  assert.deepEqual(diffPatch(row, { name: '牛奶', amount: 3, todate: '2026-10-01', shop: null }), { amount: 3 });
  assert.deepEqual(diffPatch({ lastdate1: '2026-05-18T00:00:00+00:00' }, { lastdate1: '2026-05-18' }), {});
});

test('matchSearch：多個關鍵字皆須符合', () => {
  const sub = findModule('subscription');
  const row = { name: 'Netflix', site: 'netflix.com', account: 'me@example.com', note: '家庭方案' };
  assert.equal(matchSearch(sub, row, ['netflix', '家庭']), true);
  assert.equal(matchSearch(sub, row, ['netflix', 'spotify']), false);
});

test('首頁提醒：訂閱 3/7 天、已停止續訂；食品 7 天、過期、數量不足', () => {
  const subs = [
    { name: 'A', nextdate: '2026-09-27', iscontinue: true },
    { name: 'B', nextdate: '2026-10-01' },
    { name: 'C', nextdate: '2026-09-20' },
    { name: 'D', nextdate: '2026-09-26', iscontinue: false },
    { name: 'E', nextdate: '2026-12-01' },
  ];
  const sa = subscriptionAlerts(subs, NOW);
  assert.deepEqual(sa.critical.map((s) => s.name), ['A']);
  assert.deepEqual(sa.warning.map((s) => s.name), ['B']);
  assert.deepEqual(sa.overdue.map((s) => s.name), ['C']);
  assert.deepEqual(sa.cancel.map((s) => s.name), ['D']);

  const fa = foodAlerts(
    [
      { name: '牛奶', todate: '2026-09-30', amount: 3 },
      { name: '餅乾', todate: '2026-10-20', amount: 1 },
      { name: '花生', todate: '2026-08-22', amount: 1 },
    ],
    NOW,
  );
  assert.deepEqual(fa.critical.map((f) => f.name), ['牛奶']);
  assert.deepEqual(fa.warning.map((f) => f.name), ['餅乾']);
  assert.deepEqual(fa.expired.map((f) => f.name), ['花生']);
  assert.deepEqual(fa.low.map((f) => f.name), ['餅乾']);
});

test('銀行分類：銀行 / 電子票證 / 點數', () => {
  assert.equal(bankKind({ name: '台新銀行' }), '銀行');
  assert.equal(bankKind({ name: 'Supercard超級悠遊卡' }), '電子票證');
  assert.equal(bankKind({ name: '玉山紅利點數' }), '點數');
});

test('SupabaseClient：組出正確的 REST 請求並自動分頁', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url: new URL(url), init });
    const offset = Number(new URL(url).searchParams.get('offset'));
    const body = offset === 0 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }];
    return new Response(JSON.stringify(body), { status: 200 });
  };
  const client = new SupabaseClient({ supabaseUrl: 'https://x.supabase.co/', supabaseAnonKey: 'k', bucket: 'b' }, { fetchImpl: fakeFetch });
  const rows = await client.select('food', { order: 'todate.asc', pageSize: 2 });
  assert.deepEqual(rows.map((r) => r.id), [1, 2, 3]);
  assert.equal(calls[0].url.pathname, '/rest/v1/food');
  assert.equal(calls[0].url.searchParams.get('order'), 'todate.asc');
  assert.equal(calls[0].init.headers.apikey, 'k');
  assert.equal(calls[1].url.searchParams.get('offset'), '2');
  assert.equal(client.publicUrl('gallery/a b.png'), 'https://x.supabase.co/storage/v1/object/public/b/gallery/a%20b.png');
});

test('SupabaseClient：錯誤訊息保留 PostgREST 代碼', async () => {
  const fakeFetch = async () => new Response(JSON.stringify({ code: 'PGRST205', message: 'Could not find the table' }), { status: 404 });
  const client = new SupabaseClient({ supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'k' }, { fetchImpl: fakeFetch });
  await assert.rejects(client.select('nope'), (err) => err.code === 'PGRST205' && err.status === 404);
});
