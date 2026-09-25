// 鋒兄設定：管理 Supabase 來源、檢查資料表狀態、輸出建表 SQL；以及鋒兄關於。
import fs from 'node:fs';
import { c, heading, details, section, table, withSpinner } from '../ui.js';
import { DEFAULT_SOURCE, configPath, displayName, loadConfig, maskKey, saveConfig } from '../config.js';
import { SupabaseClient, friendlyError } from '../supabase.js';
import { TABLE_SQL } from '../schema.js';
import { MODULES, GROUPS } from '../modules.js';
import { flagValue } from '../args.js';
import { formatNumber } from '../util.js';

const PKG = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
export const VERSION = PKG.version;

function validateUrl(url) {
  if (url.includes('supabse.co')) throw new Error('Supabase URL 拼字錯誤：你輸入的是 supabse.co，正確應為 supabase.co');
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Supabase URL 格式不正確，請輸入完整網址');
  }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('Supabase URL 必須以 http:// 或 https:// 開頭');
}

export async function configCommand(ctx, args, flags) {
  const [sub = 'show', name] = args;
  const config = loadConfig();

  switch (sub) {
    case 'show':
    case 'list': {
      if (flags.json) {
        return ctx.printJson({
          active: ctx.source.name,
          origin: ctx.source.origin,
          supabaseUrl: ctx.source.supabaseUrl,
          bucket: ctx.source.bucket,
          configPath: configPath(),
          profiles: ['.env', ...Object.keys(config.profiles)],
        });
      }
      ctx.print(heading('鋒兄設定', '管理來源、匯入匯出與儲存設定。'));
      ctx.print('');
      ctx.print(
        details([
          ['目前來源', `${c.green(displayName(ctx.source))}${ctx.source.origin === 'environment' ? c.gray('（來自環境變數）') : ''}`],
          ['Supabase URL', ctx.source.supabaseUrl],
          ['Anon Key', maskKey(ctx.source.supabaseAnonKey)],
          ['Bucket', ctx.source.bucket],
          ['設定檔', configPath()],
        ]),
      );
      ctx.print(section('來源列表'));
      const rows = [
        { name: '.env', url: DEFAULT_SOURCE.supabaseUrl, bucket: DEFAULT_SOURCE.bucket },
        ...Object.entries(config.profiles).map(([n, p]) => ({ name: n, url: p.supabaseUrl || '(沿用預設)', bucket: p.bucket || '(沿用預設)' })),
      ];
      ctx.print(
        table(rows, [
          { key: 'active', label: '', format: (r) => (r.name === ctx.source.name ? '●' : ''), color: (r, t) => c.green(t) },
          { key: 'name', label: '名稱' },
          { key: 'url', label: 'Supabase URL' },
          { key: 'bucket', label: 'Bucket' },
        ]),
      );
      ctx.print(c.gray('\n新增：fengbro3 config add <名稱> --url <URL> --key <anon key> [--bucket <bucket>]'));
      ctx.print(c.gray('切換：fengbro3 config use <名稱>　　測試：fengbro3 config test'));
      return;
    }
    case 'add':
    case 'set': {
      if (!name) throw new Error('請指定來源名稱：fengbro3 config add <名稱> --url … --key …');
      if (name === '.env' || name === 'env') throw new Error('「.env」與「env」是保留名稱');
      const prev = config.profiles[name] || {};
      const url = flagValue(flags, 'url');
      const key = flagValue(flags, 'key');
      const bucket = flagValue(flags, 'bucket');
      if (sub === 'add' && !prev.supabaseUrl && !url) throw new Error('新增來源需要 --url');
      if (sub === 'add' && !prev.supabaseAnonKey && !key) throw new Error('新增來源需要 --key');
      if (url) validateUrl(url);
      config.profiles[name] = {
        supabaseUrl: url ?? prev.supabaseUrl,
        supabaseAnonKey: key ?? prev.supabaseAnonKey,
        bucket: bucket ?? prev.bucket ?? DEFAULT_SOURCE.bucket,
      };
      if (flags.use !== false) config.active = name;
      saveConfig(config);
      ctx.print(c.green(`✓ 已儲存來源「${name}」${config.active === name ? '並切換使用' : ''}`));
      return;
    }
    case 'use': {
      if (!name) throw new Error('請指定來源名稱');
      if (name !== '.env' && !config.profiles[name]) throw new Error(`找不到來源「${name}」`);
      config.active = name === '.env' ? null : name;
      saveConfig(config);
      ctx.print(c.green(`✓ 已切換到 ${name === '.env' ? 'supabase-.env' : `supabase-${name}`}`));
      return;
    }
    case 'remove':
    case 'rm':
    case 'delete': {
      if (!name || !config.profiles[name]) throw new Error(`找不到來源「${name || ''}」`);
      delete config.profiles[name];
      if (config.active === name) config.active = null;
      saveConfig(config);
      ctx.print(c.green(`✓ 已移除來源「${name}」`));
      return;
    }
    case 'test':
    case 'status':
      return tableStatus(ctx, flags);
    case 'path':
      ctx.print(configPath());
      return;
    default:
      throw new Error(`未知的 config 子指令：${sub}（可用 show / add / set / use / remove / test / path）`);
  }
}

async function tableStatus(ctx, flags) {
  const client = ctx.client instanceof SupabaseClient ? ctx.client : new SupabaseClient(ctx.source);
  const results = await withSpinner('檢查資料表狀態…', () =>
    Promise.all(
      TABLE_SQL.map(async (t) => {
        try {
          return { ...t, count: await client.count(t.name), ok: true };
        } catch (err) {
          return { ...t, count: null, ok: false, error: friendlyError(err, t.name) };
        }
      }),
    ),
  );
  if (flags.json) return ctx.printJson(results.map(({ sql, ...r }) => r));
  ctx.print(heading('資料表狀態', `${displayName(ctx.source)} · ${ctx.source.supabaseUrl}`));
  ctx.print('');
  ctx.print(
    table(results, [
      { key: 'name', label: '資料表' },
      { key: 'label', label: '說明' },
      { key: 'count', label: '筆數', align: 'right', format: (r) => (r.ok ? formatNumber(r.count) : '—') },
      { key: 'status', label: '狀態', format: (r) => (r.ok ? '✓ 已建立' : `✗ ${r.error}`), color: (r, t) => (r.ok ? c.green(t) : c.red(t)) },
    ]),
  );
  const missing = results.filter((r) => !r.ok).length;
  ctx.print('');
  ctx.print(missing ? c.yellow(`有 ${missing} 張資料表無法存取；可用 \`fengbro3 sql <資料表>\` 取得建表 SQL。`) : c.green('✓ 所有資料表皆可存取'));
}

export function sqlCommand(ctx, args) {
  const name = args[0];
  if (!name || name === 'all') {
    const all = ['-- Feng AI Supabase 全表格建立 SQL', '-- 請貼到 Supabase SQL Editor 執行；id 一律使用 UUID。', ...TABLE_SQL.map((t) => `\n-- ${t.label} (${t.name})\n${t.sql}`)];
    ctx.print(all.join('\n'));
    return;
  }
  const mod = MODULES.find((m) => m.id === name || m.aliases.includes(name));
  const tableName = mod ? mod.table : name;
  const entry = TABLE_SQL.find((t) => t.name === tableName);
  if (!entry) throw new Error(`沒有「${name}」的建表 SQL。可用：${TABLE_SQL.map((t) => t.name).join(', ')}`);
  ctx.print(`-- ${entry.label} (${entry.name})\n${entry.sql}`);
}

export function aboutCommand(ctx) {
  ctx.print(heading('鋒兄關於', '查看系統說明與目前工作區資訊。'));
  ctx.print('');
  ctx.print(
    details([
      ['名稱', '鋒兄AI Supabase CLI'],
      ['版本', `v${VERSION}`],
      ['網頁版', 'https://fengbroaisupabase.netlify.app'],
      ['目前來源', `${displayName(ctx.source)} (${ctx.source.supabaseUrl})`],
      ['Node.js', process.version],
      ['模組', `${MODULES.length} 個資料模組，分為 ${GROUPS.map((g) => g.name).join('、')}`],
    ]),
  );
  ctx.print(c.gray('\n網頁版的「工具」分類（比價、Tube、金融、新聞、影音轉檔等）依賴瀏覽器與伺服器 API，CLI 版未包含。'));
  ctx.print(c.gray('鋒兄 © 2026-2027 FengBroAI Supabase'));
}
