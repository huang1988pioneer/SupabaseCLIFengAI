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

test('shell tokenize：引號、跳脫與空白', async () => {
  const { tokenize } = await import('../src/shell.js');
  assert.deepEqual(tokenize('food add "牛奶 全脂" --todate +3'), ['food', 'add', '牛奶 全脂', '--todate', '+3']);
  assert.deepEqual(tokenize("note -s 'a b' x\\ y"), ['note', '-s', 'a b', 'x y']);
  assert.deepEqual(tokenize('sub edit x --note ""'), ['sub', 'edit', 'x', '--note', '']);
  assert.deepEqual(tokenize('   '), []);
  assert.throws(() => tokenize('sub "abc'));
});

test('shell complete：指令、動作與欄位旗標', async () => {
  const { complete } = await import('../src/shell.js');
  assert.deepEqual(complete('fo')[0], ['food']);
  assert.ok(complete('sub r')[0].includes('renew'));
  assert.ok(complete('food --to')[0].includes('--todate'));
  assert.deepEqual(complete('config u')[0], ['use']);
});

test('序號、欄位=值：resolveRecord 與 splitAssignments', async () => {
  const { resolveRecord, splitAssignments } = await import('../src/commands/records.js');
  const sub = findModule('subscription');
  const rows = [
    { id: 'aaaa1111-0000', name: 'Netflix' },
    { id: 'bbbb2222-0000', name: 'Spotify' },
    { id: 'cccc3333-0000', name: '2026' },
  ];
  assert.equal((await resolveRecord({}, sub, '2', rows)).name, 'Spotify');
  assert.equal((await resolveRecord({}, sub, '#1', rows)).name, 'Netflix');
  assert.equal((await resolveRecord({}, sub, 'bbbb', rows)).name, 'Spotify');
  assert.equal((await resolveRecord({}, sub, 'spot', rows)).name, 'Spotify');
  await assert.rejects(resolveRecord({}, sub, '#9', rows), /沒有序號/);

  const { assign, rest } = splitAssignments(sub, ['Netflix', 'price=390', '幣別=美元', 'nextdate=none', 'note=a=b']);
  assert.deepEqual(rest, ['Netflix']);
  assert.deepEqual(assign, { price: 390, currency: 'USD', nextdate: null, note: 'a=b' });
  assert.throws(() => splitAssignments(sub, ['prce=3']), /沒有欄位/);
});

test('shell routeInput：模組畫面短指令', async () => {
  const { routeInput } = await import('../src/shell.js');
  const food = findModule('food');
  assert.deepEqual(routeInput(food, ['3']).argv, ['food', 'show', '3']);
  assert.deepEqual(routeInput(food, ['a', '牛奶', 'amount=2']).argv, ['food', 'add', '牛奶', 'amount=2']);
  assert.deepEqual(routeInput(food, ['e', '3', 'todate=+7']).argv, ['food', 'edit', '3', 'todate=+7']);
  assert.deepEqual(routeInput(food, ['d', '3', '5']).argv, ['food', 'delete', '3', '5']);
  assert.deepEqual(routeInput(food, ['/牛', '奶']).argv, ['food', 'list', '牛', '奶']);
  assert.deepEqual(routeInput(food, ['use', '3']).argv, ['food', 'use', '3']);
  assert.equal(routeInput(food, ['q']).leave, true);
  assert.deepEqual(routeInput(food, ['home']), { leave: true, argv: ['home'] });
  assert.deepEqual(routeInput(food, ['sub', 'due']).argv, ['sub', 'due']);
  assert.deepEqual(routeInput(null, ['3']).argv, ['3']);
});

test('貓咪騎機車：256 色轉換與半格像素繪製', async () => {
  const { rgbTo256, renderPixels } = await import('../src/ui.js');
  const { CAT_PIXELS } = await import('../src/cat-art.js');
  assert.equal(rgbTo256([255, 0, 0]), 196);
  assert.equal(rgbTo256([0, 0, 0]), 16);
  assert.equal(rgbTo256([128, 128, 128]), 244);
  const out = renderPixels(['AB.', '.BA'], { A: [255, 0, 0], B: [0, 0, 255] }, { trueColor: true });
  assert.equal(out, '\x1b[38;2;255;0;0m▀\x1b[0m\x1b[38;2;0;0;255;48;2;0;0;255m▀\x1b[0m\x1b[38;2;255;0;0m▄\x1b[0m');
  assert.ok(CAT_PIXELS.every((row) => row.length === CAT_PIXELS[0].length));
});
