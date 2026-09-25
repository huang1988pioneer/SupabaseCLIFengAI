// 持續執行的互動 shell：輸入指令、看結果、再輸入下一個，直到 exit。
import fs from 'node:fs';
import path from 'node:path';
import { c, heading, pad, strWidth } from './ui.js';
import { MODULES, findModule } from './modules.js';
import { DUE, MODULE_ACTIONS, RECORD_ACTIONS as RECORD_ACTION_MAP, moduleHint } from './commands/records.js';
import { configPath, displayName, resolveSource } from './config.js';
import { ask, configurePrompt, promptHistory, CancelledError } from './prompt.js';

const EXIT_WORDS = new Set(['exit', 'quit', 'q', ':q', 'bye', '離開', '結束']);
const TOP_COMMANDS = ['home', 'dashboard', 'menu', 'modules', 'config', 'sql', 'about', 'help', 'clear', 'exit'];
const RECORD_ACTIONS = ['list', 'show', 'add', 'edit', 'delete', 'export', 'import', 'fields'];
const CONFIG_ACTIONS = ['show', 'add', 'set', 'use', 'remove', 'test', 'path'];
const HISTORY_LIMIT = 500;

/** 把一行指令切成參數，支援單雙引號與反斜線跳脫。 */
export function tokenize(line) {
  const tokens = [];
  let current = '';
  let quote = null;
  let started = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === '\\' && quote === '"' && i + 1 < line.length) current += line[(i += 1)];
      else current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
    } else if (ch === '\\' && i + 1 < line.length) {
      current += line[(i += 1)];
      started = true;
    } else if (/\s/.test(ch)) {
      if (started) tokens.push(current);
      current = '';
      started = false;
    } else {
      current += ch;
      started = true;
    }
  }
  if (quote) throw new Error('引號沒有成對');
  if (started) tokens.push(current);
  return tokens;
}

function actionsFor(mod) {
  const list = [...RECORD_ACTIONS, ...Object.keys(MODULE_ACTIONS[mod.id] || {})];
  if (DUE[mod.id]) list.push('due');
  if (mod.fields.some((f) => f.media)) list.push('url');
  return list;
}

/** Tab 補全：第一個字補指令或模組，第二個字補動作，--開頭補欄位旗標。 */
export function complete(line) {
  const words = line.split(/\s+/);
  const last = words[words.length - 1];
  const prior = words.slice(0, -1).filter(Boolean);
  const mod = MODULES.find((m) => m.id === prior[0] || m.aliases.includes(prior[0]));
  let candidates;
  if (last.startsWith('--')) {
    const common = ['--json', '--dry-run', '--search', '--limit', '--sort', '--desc', '--full', '--reveal', '--all', '--yes'];
    candidates = [...(mod ? mod.fields.filter((f) => !f.hidden).map((f) => `--${f.key}`) : []), ...common];
  } else if (prior.length === 0) {
    candidates = [...TOP_COMMANDS, ...MODULES.map((m) => m.id)];
  } else if (prior.length === 1 && mod) {
    candidates = actionsFor(mod);
  } else if (prior.length === 1 && (prior[0] === 'config' || prior[0] === 'settings')) {
    candidates = CONFIG_ACTIONS;
  } else if (prior.length === 1 && (prior[0] === 'sql' || prior[0] === 'help')) {
    candidates = MODULES.map((m) => m.id);
  } else {
    candidates = [];
  }
  const hits = candidates.filter((w) => w.startsWith(last));
  return [hits.length ? hits : candidates, last];
}

const BACK_WORDS = new Set(['q', 'b', '..', 'back', '返回']);
const SHORT_ACTIONS = { a: 'add', e: 'edit', d: 'delete', l: 'list', r: 'list', ls: 'list' };
const LIST_ACTIONS = new Set(['list', 'ls', 'search', 'find']);

/**
 * 在模組畫面中解讀輸入（像 Appwrite 版）：3 查看、a 新增、e 3 編輯、d 3 刪除、/關鍵字 搜尋、q 返回。
 * 回傳 { argv }（要執行的完整指令）；離開模組時 leave 為 true（可能同時帶 argv，例如 home）。
 * 不是模組短指令時原樣回傳。
 */
export function routeInput(mod, argv) {
  if (!mod || !argv.length) return { argv };
  const [first, ...rest] = argv;
  const word = first.toLowerCase();
  if (BACK_WORDS.has(word)) return { leave: true };
  if (word === 'home') return { leave: true, argv };
  if (first.startsWith('/')) return { argv: [mod.id, 'list', ...[first.slice(1), ...rest].filter(Boolean)] };
  if (/^#?\d+$/.test(first) && !rest.length) return { argv: [mod.id, 'show', first] };
  if (SHORT_ACTIONS[word]) return { argv: [mod.id, SHORT_ACTIONS[word], ...rest] };
  if (RECORD_ACTION_MAP[word] || MODULE_ACTIONS[mod.id]?.[word]) return { argv: [mod.id, ...argv] };
  return { argv };
}

/** 這個指令會不會顯示模組列表（顯示後附上操作提示）。 */
function showsList(argv) {
  const mod = findModule(argv[0]);
  if (!mod) return false;
  const action = argv[1];
  return action === undefined || LIST_ACTIONS.has(action.toLowerCase()) || !(RECORD_ACTION_MAP[action.toLowerCase()] || MODULE_ACTIONS[mod.id]?.[action.toLowerCase()] || /^#?\d+$/.test(action));
}

function historyFile() {
  return path.join(path.dirname(configPath()), 'history');
}

function loadHistory() {
  try {
    return fs.readFileSync(historyFile(), 'utf8').split('\n').filter(Boolean).reverse().slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function saveHistory() {
  const lines = promptHistory().slice(0, HISTORY_LIMIT).reverse();
  if (!lines.length) return;
  try {
    fs.mkdirSync(path.dirname(historyFile()), { recursive: true });
    fs.writeFileSync(historyFile(), `${lines.join('\n')}\n`, { mode: 0o600 });
  } catch {
    // 歷史紀錄寫不進去不影響使用。
  }
}

export function shellHelp() {
  const rows = [
    ['sub', '進入訂閱模組並列表；之後可用下面的短指令'],
    ['3', '查看序號 3'],
    ['a', '新增（逐欄詢問，也可 a 名稱 price=390）'],
    ['e 3', '編輯序號 3（逐欄詢問，也可 e 3 price=390 note=備註）'],
    ['d 3 5', '刪除序號 3 和 5（會先確認）'],
    ['/關鍵字', '在目前模組搜尋；/ 清除搜尋'],
    ['q', '離開目前模組'],
    ['help', '顯示說明（help <模組> 看模組說明）'],
    ['clear', '清除畫面'],
    ['exit', '離開（也可以按 Ctrl+D）'],
    ['Tab', '補全指令、模組、動作與 --欄位'],
    ['↑ / ↓', '瀏覽之前輸入過的指令'],
    ['Ctrl+C', '取消目前輸入或新增／編輯流程'],
  ];
  const w = Math.max(...rows.map(([k]) => strWidth(k)));
  return [
    '',
    c.bold('互動 shell'),
    c.gray('  直接輸入指令即可，不需要再打 fengbro3；輸入模組名稱後會停在該模組，用序號操作資料'),
    ...rows.map(([k, d]) => `  ${c.green(pad(k, w))}  ${c.gray(d)}`),
  ].join('\n');
}

function promptLabel(mod) {
  let name = '?';
  try {
    name = displayName(resolveSource());
  } catch {
    // 設定有誤時仍然讓 shell 可以用，錯誤會在執行指令時顯示。
  }
  const where = mod ? ` ${c.bold(mod.name)}` : '';
  return `${c.green('fengbro3')}${where} ${c.gray(`(${name})`)} ${c.cyan('›')}`;
}

/**
 * 啟動 shell。execute(argv, { inShell }) 由 cli.js 提供；startArgs 為啟動時附帶的全域旗標（例如 --profile）。
 */
export async function runShell(execute, startArgs = []) {
  configurePrompt({ completer: complete, history: loadHistory() });
  const interactive = Boolean(process.stdin.isTTY);

  await execute(['home', ...startArgs], { inShell: true });
  process.stdout.write(`${heading('互動模式', '輸入指令後按 Enter；help 看說明、Tab 補全、exit 離開。')}\n\n`);

  let lastCode = 0;
  let current = null; // 目前所在的模組
  for (;;) {
    let line;
    try {
      line = await ask(promptLabel(current), { record: true });
    } catch (err) {
      if (err instanceof CancelledError && !err.eof) continue;
      break; // Ctrl+D 或管線輸入結束
    }

    let argv;
    try {
      argv = tokenize(line);
    } catch (err) {
      process.stderr.write(`${c.red(`✗ ${err.message}`)}\n`);
      continue;
    }
    if (!argv.length) continue;
    if (argv[0] === 'fengbro3' || argv[0] === 'feng') argv.shift(); // 習慣打全名也沒關係
    if (!argv.length) continue;

    const routed = routeInput(current, argv);
    if (routed.leave) current = null;
    if (!routed.argv) continue;
    argv = routed.argv;
    const word = argv[0].toLowerCase();
    if (EXIT_WORDS.has(word)) break;
    if (word === 'clear' || word === 'cls') {
      if (interactive) process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
      continue;
    }
    if (word === 'shell') {
      process.stdout.write(c.gray('已經在互動模式中。\n'));
      continue;
    }

    const target = findModule(argv[0]);
    if (target) current = target;
    try {
      lastCode = await execute([...argv, ...startArgs], { inShell: true });
    } catch (err) {
      process.stderr.write(`${c.red(`✗ ${err.message}`)}\n`);
      lastCode = 1;
    }
    if (target && lastCode === 0 && showsList(argv)) process.stdout.write(`${moduleHint(target)}\n`);
    process.stdout.write('\n');
  }

  if (interactive) saveHistory();
  process.stdout.write(c.gray('再見！\n'));
  return interactive ? 0 : lastCode;
}
