// 各資料模組的通用指令：list / show / add / edit / delete / export / import / fields / url / due。
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { c, table, details, heading, withSpinner } from '../ui.js';
import { fieldOf, formatFieldValue, titleOf } from '../modules.js';
import { daysUntil, formatDate, formatDays, normalize, parseBool, parseDateInput, today } from '../util.js';
import { parseCsvObjects, toCsv } from '../csv.js';
import { flagValue } from '../args.js';
import { ask, canPrompt, confirm } from '../prompt.js';

// 有到期日概念的模組：due 指令使用的欄位與預設天數。
export const DUE = {
  subscription: { field: 'nextdate', days: 7, critical: 3 },
  food: { field: 'todate', days: 30, critical: 7 },
  quota: { field: 'quotaexpiry', days: 7, critical: 3 },
  'trial-purchase': { field: 'eventdate', days: 7, critical: 3 },
  shopping: { field: 'planneddate', days: 7, critical: 1 },
};

// 匯入時用來判斷「同一筆資料」的鍵（對應網頁版匯入邏輯）。
const IMPORT_KEYS = {
  'trial-purchase': ['name', 'account'],
  quota: ['name', 'account'],
  reinstall: ['name', 'system'],
  music: ['name', 'language'],
  note: ['title'],
};

// 控制用旗標，不會被當成欄位。
const CONTROL_FLAGS = new Set([
  'json', 'yes', 'help', 'reveal', 'all', 'dry-run', 'color', 'desc', 'asc', 'profile', 'search', 'limit', 'sort',
  'format', 'output', 'upload', 'upload-cover', 'open', 'public', 'overdue', 'ids', 'full', 'interactive', 'date',
  'days', 'months', 'by',
]);

const shortId = (id) => String(id || '').slice(0, 8);

// ---------- 欄位轉換 ----------

export function convertField(field, raw) {
  if (raw === true && field.type !== 'bool') throw new Error(`--${field.key} 需要一個值`);
  if (raw === null || raw === undefined) return null;
  const value = typeof raw === 'string' ? raw.trim() : raw;
  if (value === '' || value === 'null') return null;

  switch (field.type) {
    case 'int': {
      const n = Number(String(value).replace(/,/g, ''));
      if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`${field.label}（${field.key}）必須是整數：「${value}」`);
      return n;
    }
    case 'bool':
      return parseBool(value);
    case 'date':
      return parseDateInput(value);
    case 'datetime':
      return parseDateInput(value);
    case 'enum': {
      const v = normalize(value);
      const opt = field.options.find((o) => normalize(o.value) === v || normalize(o.label) === v);
      if (!opt) {
        throw new Error(`${field.label}（${field.key}）只能是：${field.options.map((o) => `${o.value}(${o.label})`).join('、')}`);
      }
      return opt.value;
    }
    default: {
      const s = String(value);
      if (field.max && s.length > field.max) throw new Error(`${field.label}（${field.key}）最多 ${field.max} 個字元`);
      return s;
    }
  }
}

function payloadFromFlags(mod, flags) {
  const payload = {};
  const unknown = [];
  for (const [key, raw] of Object.entries(flags)) {
    if (CONTROL_FLAGS.has(key)) continue;
    const field = fieldOf(mod, key);
    if (!field) {
      unknown.push(key);
      continue;
    }
    const value = Array.isArray(raw) ? raw[raw.length - 1] : raw;
    payload[field.key] = convertField(field, value);
  }
  if (unknown.length) {
    throw new Error(`未知欄位：${unknown.map((k) => `--${k}`).join(' ')}\n可用欄位請執行：fengbro3 ${mod.id} fields`);
  }
  return payload;
}

function applyDefaults(mod, payload) {
  for (const field of mod.fields) {
    if (payload[field.key] !== undefined) continue;
    if (field.defaultToday) payload[field.key] = today();
    else if (field.default !== undefined) payload[field.key] = field.default;
  }
  return payload;
}

function checkRequired(mod, payload) {
  const missing = mod.fields.filter((f) => f.required && (payload[f.key] === undefined || payload[f.key] === null || payload[f.key] === ''));
  if (missing.length) throw new Error(`缺少必填欄位：${missing.map((f) => `--${f.key}（${f.label}）`).join('、')}`);
}

async function promptFields(mod, current = {}) {
  const payload = {};
  process.stdout.write(c.gray('直接按 Enter 保留預設值；輸入 - 清空欄位。\n'));
  for (const field of mod.fields) {
    if (field.hidden) continue;
    let hint = '';
    if (field.type === 'enum') hint = c.gray(` (${field.options.map((o) => `${o.value}=${o.label}`).join(', ')})`);
    if (field.type === 'bool') hint = c.gray(' (y/n)');
    if (field.type === 'date' || field.type === 'datetime') hint = c.gray(' (YYYY-MM-DD / today / +7)');
    if (field.suggestions) hint = c.gray(` (${field.suggestions.join('、')})`);
    const existing = current[field.key] ?? (field.defaultToday ? today() : field.default);
    const shown = existing === undefined || existing === null ? undefined : field.type === 'bool' ? (existing ? 'y' : 'n') : formatDate(existing);
    for (;;) {
      const answer = await ask(`${field.required ? c.red('*') : ' '}${field.label}${hint}:`, { defaultValue: shown });
      if (answer === '-') {
        payload[field.key] = null;
        break;
      }
      if (answer === '' || answer === shown) {
        if (field.required && !answer) {
          process.stdout.write(c.yellow('  此欄位必填。\n'));
          continue;
        }
        if (current[field.key] === undefined && answer !== '') payload[field.key] = convertField(field, answer);
        break;
      }
      try {
        payload[field.key] = convertField(field, answer);
        break;
      } catch (err) {
        process.stdout.write(c.yellow(`  ${err.message}\n`));
      }
    }
  }
  return payload;
}

/** 只保留與現有資料不同的欄位。 */
export function diffPatch(row, patch) {
  const out = {};
  for (const [k, v] of Object.entries(patch)) {
    const old = row[k] ?? null;
    const same = old === v || (old !== null && v !== null && formatDate(old) === String(v));
    if (!same) out[k] = v;
  }
  return out;
}

// ---------- 讀取與搜尋 ----------

async function fetchAll(ctx, mod) {
  return withSpinner(`讀取${mod.name}…`, () => ctx.client.select(mod.table, { order: mod.order }));
}

export function matchSearch(mod, row, terms) {
  if (!terms.length) return true;
  const haystack = mod.search.map((k) => normalize(row[k])).join('\n');
  return terms.every((t) => haystack.includes(t));
}

function searchTerms(flags, extra = []) {
  const raw = [flagValue(flags, 'search'), ...extra].filter((v) => typeof v === 'string' && v.trim());
  return raw.join(' ').split(/\s+/).map(normalize).filter(Boolean);
}

export async function resolveRecord(ctx, mod, ref, rows) {
  if (!ref) throw new Error(`請指定要操作的資料（id、id 前綴或${mod.titleField === 'title' ? '標題' : '名稱'}）`);
  const list = rows || (await fetchAll(ctx, mod));
  const key = normalize(ref);
  const titleKey = mod.titleField || 'name';
  const byId = list.find((r) => normalize(r.id) === key);
  if (byId) return byId;
  const candidates = [
    list.filter((r) => key.length >= 4 && normalize(r.id).startsWith(key)),
    list.filter((r) => normalize(r[titleKey]) === key),
    list.filter((r) => normalize(r[titleKey]).includes(key)),
  ];
  for (const found of candidates) {
    if (found.length === 1) return found[0];
    if (found.length > 1) {
      const lines = found.slice(0, 10).map((r) => `  ${c.gray(shortId(r.id))}  ${titleOf(mod, r)}${r.account ? c.gray(`  ${r.account}`) : ''}`);
      throw new Error(`「${ref}」符合 ${found.length} 筆，請改用 id：\n${lines.join('\n')}${found.length > 10 ? '\n  …' : ''}`);
    }
  }
  throw new Error(`找不到「${ref}」`);
}

// ---------- 指令 ----------

function listColumns(mod, flags) {
  const cols = [{ key: 'id', label: 'ID', format: (r) => shortId(r.id), color: (r, t) => c.gray(t) }, ...mod.columns];
  if (flags.full) return cols.map((col) => ({ ...col, max: undefined }));
  return cols;
}

function sortRows(rows, flags) {
  const key = flagValue(flags, 'sort');
  if (!key) return rows;
  const dir = flags.desc ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = a[key];
    const y = b[key];
    if (x === y) return 0;
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
    return String(x).localeCompare(String(y), 'zh-Hant') * dir;
  });
}

export async function listCommand(ctx, mod, args, flags) {
  let rows = await fetchAll(ctx, mod);
  const terms = searchTerms(flags, args);
  rows = rows.filter((r) => matchSearch(mod, r, terms));
  rows = sortRows(rows, flags);
  const matched = rows;
  const limit = Number(flagValue(flags, 'limit')) || 0;
  if (limit > 0) rows = rows.slice(0, limit);

  if (flags.json) return ctx.printJson(rows);
  ctx.print(heading(mod.title, mod.subtitle));
  ctx.print('');
  ctx.print(table(rows, listColumns(mod, flags)));
  ctx.print('');
  const info = [];
  if (terms.length) info.push(`搜尋「${terms.join(' ')}」`);
  info.push(rows.length < matched.length ? `顯示 ${rows.length} / ${matched.length} 筆` : `共 ${matched.length} 筆`);
  ctx.print(c.gray(info.join('，')));
  if (mod.summary && matched.length) ctx.print(c.cyan(mod.summary(matched)));
}

export async function showCommand(ctx, mod, args, flags) {
  const row = await resolveRecord(ctx, mod, args.join(' '));
  if (flags.json) return ctx.printJson(row);
  ctx.print(heading(`${mod.title} › ${titleOf(mod, row)}`));
  ctx.print('');
  const pairs = [['ID', row.id]];
  for (const field of mod.fields) {
    if (field.hidden && !flags.all) continue;
    const value = row[field.key];
    if ((value === null || value === undefined || value === '') && !flags.all) continue;
    pairs.push([field.label, formatFieldValue(field, value, { reveal: flags.reveal })]);
  }
  if (mod.detail) pairs.push(...mod.detail(row));
  pairs.push(['建立', formatDate(row.created_at)], ['更新', formatDate(row.updated_at)]);
  ctx.print(details(pairs));
  const mediaFields = mod.fields.filter((f) => f.media && row[f.key]);
  if (mediaFields.length) {
    ctx.print('');
    for (const f of mediaFields) {
      const url = await ctx.client.resolveFileUrl(row[f.key], { sign: !flags.public });
      ctx.print(`${c.gray(`${f.label}連結`)}  ${c.underline(url)}`);
    }
  }
}

async function handleUploads(ctx, mod, payload, flags) {
  const upload = flagValue(flags, 'upload');
  const cover = flagValue(flags, 'upload-cover');
  if (!upload && !cover) return;
  const folder = mod.media?.folder || mod.id;
  if (upload && typeof upload === 'string') {
    if (flags['dry-run']) {
      payload.file = `${folder}/<上傳後產生>_${path.basename(upload)}`;
    } else {
      const res = await withSpinner(`上傳 ${path.basename(upload)}…`, () => ctx.client.upload(upload, folder));
      ctx.print(c.green(`✓ 已上傳 ${res.path}（${(res.size / 1024).toFixed(1)} KB）`));
      payload.file = res.path;
    }
    if (fieldOf(mod, 'filetype') && payload.filetype === undefined) payload.filetype = path.extname(upload).slice(1).toLowerCase() || null;
    if (payload.name === undefined && fieldOf(mod, 'name')) payload.name = path.basename(upload, path.extname(upload));
  }
  if (cover && typeof cover === 'string') {
    const coverFolder = mod.media?.coverFolder || `${folder}-covers`;
    if (flags['dry-run']) {
      payload.cover = `${coverFolder}/<上傳後產生>_${path.basename(cover)}`;
    } else {
      const res = await withSpinner(`上傳封面 ${path.basename(cover)}…`, () => ctx.client.upload(cover, coverFolder));
      ctx.print(c.green(`✓ 已上傳封面 ${res.path}`));
      payload.cover = res.path;
    }
  }
}

export async function addCommand(ctx, mod, args, flags) {
  let payload = payloadFromFlags(mod, flags);
  const titleKey = mod.titleField || 'name';
  if (args.length && payload[titleKey] === undefined) payload[titleKey] = convertField(fieldOf(mod, titleKey), args.join(' '));
  await handleUploads(ctx, mod, payload, flags);

  if (flags.interactive || (Object.keys(payload).length === 0 && canPrompt())) {
    ctx.print(heading(`新增${mod.name}`));
    payload = { ...payload, ...(await promptFields(mod, payload)) };
  }
  applyDefaults(mod, payload);
  checkRequired(mod, payload);

  if (flags['dry-run']) {
    ctx.print(c.yellow('（dry-run，不會寫入）'));
    return ctx.printJson({ table: mod.table, insert: payload });
  }
  const [created] = await withSpinner('寫入 Supabase…', () => ctx.client.insert(mod.table, payload));
  if (flags.json) return ctx.printJson(created);
  ctx.print(c.green(`✓ 已新增${mod.name}「${titleOf(mod, created || payload)}」`) + c.gray(created?.id ? `  id ${created.id}` : ''));
}

export async function editCommand(ctx, mod, args, flags) {
  const [ref, ...rest] = args;
  const row = await resolveRecord(ctx, mod, ref);
  let patch = payloadFromFlags(mod, flags);
  await handleUploads(ctx, mod, patch, flags);
  if (rest.length) throw new Error(`多餘的參數：${rest.join(' ')}（名稱含空白請加引號）`);

  if (flags.interactive || (Object.keys(patch).length === 0 && canPrompt())) {
    ctx.print(heading(`編輯${mod.name}「${titleOf(mod, row)}」`));
    const answers = await promptFields(mod, row);
    patch = { ...answers, ...patch };
  }
  patch = diffPatch(row, patch);
  if (!Object.keys(patch).length) {
    ctx.print(c.gray('沒有任何變更。'));
    return;
  }
  const titleKey = mod.titleField || 'name';
  if (titleKey in patch && !patch[titleKey]) throw new Error('名稱不可為空白');
  patch.updated_at = new Date().toISOString();

  if (flags['dry-run']) {
    ctx.print(c.yellow('（dry-run，不會寫入）'));
    return ctx.printJson({ table: mod.table, id: row.id, update: patch });
  }
  const updated = await withSpinner('更新 Supabase…', () => ctx.client.update(mod.table, row.id, patch));
  if (flags.json) return ctx.printJson(updated);
  const changed = Object.keys(patch).filter((k) => k !== 'updated_at');
  ctx.print(c.green(`✓ 已更新「${titleOf(mod, updated)}」`) + c.gray(`（${changed.map((k) => fieldOf(mod, k)?.label || k).join('、')}）`));
}

export async function deleteCommand(ctx, mod, args, flags) {
  if (!args.length) throw new Error('請指定要刪除的資料（可一次多筆）');
  const rows = await fetchAll(ctx, mod);
  const targets = [];
  for (const ref of args) targets.push(await resolveRecord(ctx, mod, ref, rows));
  const unique = [...new Map(targets.map((r) => [r.id, r])).values()];

  ctx.print(c.bold(`即將刪除 ${unique.length} 筆${mod.name}：`));
  unique.forEach((r) => ctx.print(`  ${c.gray(shortId(r.id))}  ${titleOf(mod, r)}`));
  if (flags['dry-run']) {
    ctx.print(c.yellow('（dry-run，不會刪除）'));
    return;
  }
  if (!flags.yes) {
    if (!canPrompt()) throw new Error('非互動模式請加上 --yes 確認刪除');
    if (!(await confirm(c.red('此操作無法復原，確定刪除？')))) {
      ctx.print(c.gray('已取消。'));
      return;
    }
  }
  let ok = 0;
  for (const r of unique) {
    try {
      await ctx.client.remove(mod.table, r.id);
      ok += 1;
    } catch (err) {
      ctx.error(`✗ 刪除「${titleOf(mod, r)}」失敗：${err.message}`);
    }
  }
  ctx.print(c.green(`✓ 已刪除 ${ok} 筆`));
}

export function exportHeaders(mod) {
  return ['id', ...mod.fields.map((f) => f.key), 'created_at', 'updated_at'];
}

export async function exportCommand(ctx, mod, args, flags) {
  const rows = await fetchAll(ctx, mod);
  const file = args[0] || flagValue(flags, 'output');
  const format = (flagValue(flags, 'format') || (file && path.extname(file).slice(1)) || 'csv').toLowerCase();
  let content;
  if (format === 'json') content = `${JSON.stringify(rows, null, 2)}\n`;
  else if (format === 'csv') content = toCsv(exportHeaders(mod), rows);
  else throw new Error('只支援 csv 或 json 格式');

  if (!file || file === '-') {
    process.stdout.write(format === 'csv' ? content.replace(/^﻿/, '') : content);
    return;
  }
  await fs.writeFile(file, content);
  ctx.print(c.green(`✓ 已匯出 ${rows.length} 筆${mod.name}到 ${file}`));
}

const SYSTEM_COLUMNS = new Set(['id', 'created_at', 'updated_at', '$id', '$createdAt', '$updatedAt', '$collectionId', '$databaseId', '$permissions', '$sequence', '$tenant']);

export function rowToPayload(mod, raw) {
  const payload = {};
  for (const [key, value] of Object.entries(raw)) {
    if (SYSTEM_COLUMNS.has(key)) continue;
    const field = fieldOf(mod, key);
    if (!field) continue;
    payload[field.key] = convertField(field, typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' ? String(value) : value);
  }
  return payload;
}

export async function importCommand(ctx, mod, args, flags) {
  const file = args[0];
  if (!file) throw new Error(`請指定檔案：fengbro3 ${mod.id} import <檔案.csv|檔案.json>`);
  const text = await fs.readFile(file, 'utf8');
  const isJson = path.extname(file).toLowerCase() === '.json' || /^\s*[[{]/.test(text.replace(/^﻿/, ''));
  let records = isJson ? JSON.parse(text.replace(/^﻿/, '')) : parseCsvObjects(text);
  if (!Array.isArray(records)) records = [records];

  const parsed = [];
  const errors = [];
  records.forEach((raw, i) => {
    try {
      const payload = rowToPayload(mod, raw);
      checkRequired(mod, payload);
      parsed.push(payload);
    } catch (err) {
      errors.push(`第 ${i + 1} 筆：${err.message}`);
    }
  });

  const existing = await fetchAll(ctx, mod);
  const keys = IMPORT_KEYS[mod.id] || [mod.titleField || 'name'];
  const keyOf = (r) => keys.map((k) => normalize(r[k])).join('\u0000');
  const index = new Map(existing.map((r) => [keyOf(r), r]));
  const inserts = [];
  const updates = [];
  let unchanged = 0;
  for (const p of parsed) {
    const match = index.get(keyOf(p));
    if (!match) inserts.push(p);
    else {
      const patch = diffPatch(match, p);
      if (Object.keys(patch).length) updates.push({ id: match.id, patch });
      else unchanged += 1;
    }
  }

  ctx.print(heading(`匯入${mod.name}`, file));
  ctx.print(
    `  新增 ${c.green(inserts.length)} 筆、更新 ${c.cyan(updates.length)} 筆、未變更 ${unchanged} 筆、錯誤 ${errors.length ? c.red(errors.length) : 0} 筆`,
  );
  errors.slice(0, 10).forEach((e) => ctx.print(c.red(`  ✗ ${e}`)));
  if (errors.length > 10) ctx.print(c.red(`  … 還有 ${errors.length - 10} 筆錯誤`));
  if (flags['dry-run'] || (!inserts.length && !updates.length)) {
    if (flags['dry-run']) ctx.print(c.yellow('（dry-run，不會寫入）'));
    return;
  }
  if (!flags.yes) {
    if (!canPrompt()) throw new Error('非互動模式請加上 --yes 確認匯入');
    if (!(await confirm('確定匯入？'))) return ctx.print(c.gray('已取消。'));
  }
  let ok = 0;
  let fail = 0;
  await withSpinner('匯入中…', async () => {
    for (let i = 0; i < inserts.length; i += 200) {
      const chunk = inserts.slice(i, i + 200).map((p) => applyDefaults(mod, p));
      try {
        await ctx.client.insert(mod.table, chunk);
        ok += chunk.length;
      } catch (err) {
        fail += chunk.length;
        ctx.error(`✗ 新增失敗：${err.message}`);
      }
    }
    for (const u of updates) {
      try {
        await ctx.client.update(mod.table, u.id, { ...u.patch, updated_at: new Date().toISOString() });
        ok += 1;
      } catch (err) {
        fail += 1;
        ctx.error(`✗ 更新失敗：${err.message}`);
      }
    }
  });
  ctx.print(fail ? c.yellow(`成功 ${ok}、失敗 ${fail}`) : c.green(`✓ 匯入完成，共 ${ok} 筆`));
}

export function fieldsCommand(ctx, mod) {
  ctx.print(heading(`${mod.title} 欄位`, `資料表 public.${mod.table}`));
  ctx.print('');
  const rows = mod.fields.map((f) => ({
    key: `--${f.key}`,
    label: f.label,
    type: f.type === 'enum' ? f.options.map((o) => o.value).join(' | ') : f.type,
    note: [f.required ? c.red('必填') : '', f.max ? `≤${f.max}字` : '', f.default !== undefined ? `預設 ${f.default}` : '', f.secret ? '機密' : '', f.hidden ? '進階' : '']
      .filter(Boolean)
      .join(' '),
  }));
  ctx.print(table(rows, [
    { key: 'key', label: '旗標' },
    { key: 'label', label: '名稱' },
    { key: 'type', label: '型別 / 選項' },
    { key: 'note', label: '說明' },
  ]));
  ctx.print(c.gray('\n日期可用 YYYY-MM-DD、today、tomorrow、+7、-3、+1m；輸入空字串 "" 可清空欄位。'));
}

function openExternal(url) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const argv = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  spawn(cmd, argv, { stdio: 'ignore', detached: true }).unref();
}

export async function urlCommand(ctx, mod, args, flags) {
  const media = mod.fields.filter((f) => f.media);
  if (!media.length) throw new Error(`${mod.name}沒有檔案欄位`);
  const row = await resolveRecord(ctx, mod, args.join(' '));
  const urls = [];
  for (const f of media) {
    if (!row[f.key]) continue;
    urls.push({ field: f.label, url: await ctx.client.resolveFileUrl(row[f.key], { sign: !flags.public }) });
  }
  if (!urls.length) throw new Error(`「${titleOf(mod, row)}」沒有檔案`);
  if (flags.json) return ctx.printJson(urls);
  urls.forEach((u) => ctx.print(`${c.gray(u.field)}  ${u.url}`));
  if (flags.open) openExternal(urls[0].url);
}

export async function dueCommand(ctx, mod, args, flags) {
  const due = DUE[mod.id];
  if (!due) throw new Error(`${mod.name}沒有到期日欄位`);
  const days = Number(args[0] ?? flagValue(flags, 'days') ?? due.days);
  if (!Number.isFinite(days)) throw new Error('天數必須是數字');
  const rows = (await fetchAll(ctx, mod))
    .map((r) => ({ ...r, _days: daysUntil(r[due.field]) }))
    .filter((r) => r._days !== null && r._days <= days && (flags.overdue || r._days >= 0))
    .filter((r) => !(mod.id === 'subscription' && r.iscontinue === false && r._days < 0))
    .sort((a, b) => a._days - b._days);
  if (flags.json) return ctx.printJson(rows.map(({ _days, ...r }) => ({ ...r, daysRemaining: _days })));
  ctx.print(heading(`${mod.title}：${days} 天內到期${flags.overdue ? '（含已過期）' : ''}`));
  ctx.print('');
  ctx.print(table(rows, [
    { key: 'id', label: 'ID', format: (r) => shortId(r.id), color: (r, t) => c.gray(t) },
    { key: 'title', label: '名稱', max: 36, format: (r) => titleOf(mod, r) },
    { key: 'date', label: '日期', format: (r) => formatDate(r[due.field]) },
    {
      key: 'days',
      label: '剩餘',
      format: (r) => formatDays(r._days),
      color: (r, t) => (r._days < 0 ? c.gray(t) : r._days <= due.critical ? c.red(t) : c.yellow(t)),
    },
    ...mod.columns.filter((col) => ['price', 'amount', 'account', 'iscontinue'].includes(col.key)),
  ]));
}

// ---------- 模組專屬操作 ----------

export async function toggleCommand(ctx, mod, args, flags) {
  const row = await resolveRecord(ctx, mod, args.join(' '));
  const next = row.iscontinue === false;
  if (flags['dry-run']) return ctx.printJson({ id: row.id, iscontinue: next });
  await ctx.client.update(mod.table, row.id, { iscontinue: next, updated_at: new Date().toISOString() });
  ctx.print(c.green(`✓「${row.name}」已${next ? '恢復續訂' : '停止續訂'}`));
}

export async function renewCommand(ctx, mod, args, flags) {
  const row = await resolveRecord(ctx, mod, args.join(' '));
  if (!row.nextdate) throw new Error(`「${row.name}」沒有設定下次扣款日`);
  const months = Number(flagValue(flags, 'months') ?? 1);
  if (!Number.isInteger(months) || months === 0) throw new Error('--months 必須是非零整數');
  const [y, m, d] = formatDate(row.nextdate).split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  const next = target.toISOString().slice(0, 10);
  if (flags['dry-run']) return ctx.printJson({ id: row.id, nextdate: { from: formatDate(row.nextdate), to: next } });
  await ctx.client.update(mod.table, row.id, { nextdate: next, updated_at: new Date().toISOString() });
  ctx.print(c.green(`✓「${row.name}」下次扣款日 ${formatDate(row.nextdate)} → ${next}`));
}

export async function doneCommand(ctx, mod, args, flags) {
  const row = await resolveRecord(ctx, mod, args.join(' '));
  const date = parseDateInput(flagValue(flags, 'date') || 'today');
  const patch = { lastdate1: date, lastdate2: row.lastdate1 || null, lastdate3: row.lastdate2 || null, updated_at: new Date().toISOString() };
  if (formatDate(row.lastdate1) === date) {
    ctx.print(c.gray(`「${row.name}」最近一次已經是 ${date}。`));
    return;
  }
  if (flags['dry-run']) return ctx.printJson({ id: row.id, update: patch });
  await ctx.client.update(mod.table, row.id, patch);
  const gap = row.lastdate1 ? `，距上次 ${Math.abs(daysUntil(row.lastdate1, new Date(`${date}T12:00:00`)))} 天` : '';
  ctx.print(c.green(`✓ 已記錄「${row.name}」於 ${date} 完成${gap}`));
}

export async function useCommand(ctx, mod, args, flags) {
  const [ref, qty = '1'] = args;
  const row = await resolveRecord(ctx, mod, ref);
  const n = Number(qty);
  if (!Number.isInteger(n) || n <= 0) throw new Error('數量必須是正整數');
  const amount = Math.max(0, (Number(row.amount) || 0) - n);
  if (flags['dry-run']) return ctx.printJson({ id: row.id, amount: { from: row.amount, to: amount } });
  await ctx.client.update(mod.table, row.id, { amount, updated_at: new Date().toISOString() });
  ctx.print(c.green(`✓「${row.name}」數量 ${row.amount ?? 0} → ${amount}`) + (amount === 0 ? c.yellow('  已用完，記得補貨') : ''));
}

export const MODULE_ACTIONS = {
  subscription: {
    toggle: { run: toggleCommand, usage: 'toggle <id|名稱>', desc: '切換續訂 / 停止續訂' },
    renew: { run: renewCommand, usage: 'renew <id|名稱> [--months 1]', desc: '把下次扣款日往後推 N 個月' },
  },
  routine: {
    done: { run: doneCommand, usage: 'done <id|名稱> [--date today]', desc: '記錄完成（最近一次日期往後遞移）' },
  },
  food: {
    use: { run: useCommand, usage: 'use <id|名稱> [數量]', desc: '消耗庫存數量' },
  },
};
