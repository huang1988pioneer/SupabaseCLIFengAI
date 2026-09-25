// 互動式輸入工具（readline）。單次指令與持續執行的 shell 共用同一個介面。
import readline from 'node:readline';
import { c } from './ui.js';

let rl = null;
const queued = [];
const waiting = [];
let closed = false;
let options = {};
let onInterrupt = null;

export class CancelledError extends Error {
  constructor({ eof = false } = {}) {
    super(eof ? '輸入已結束' : '已取消');
    this.name = 'CancelledError';
    this.eof = eof;
  }
}

/** 在第一次讀取前設定 Tab 補全與歷史紀錄（shell 使用）。 */
export function configurePrompt({ completer, history } = {}) {
  options = { completer, history };
}

/** 設定 Ctrl+C 強制退出前要做的事（例如 shell 儲存指令歷史）。 */
export function setInterruptHandler(fn) {
  onInterrupt = fn;
}

// 使用 line 事件自行排隊，讓管線輸入（非 TTY）也能逐行讀取。
function getInterface() {
  if (!rl) {
    const terminal = Boolean(process.stdin.isTTY);
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal,
      completer: terminal ? options.completer : undefined,
      history: options.history ? [...options.history] : [],
      historySize: 500,
      removeHistoryDuplicates: true,
    });
    closed = false;
    rl.on('line', (line) => {
      const next = waiting.shift();
      if (next) next.resolve(line);
      else queued.push(line);
    });
    rl.on('close', () => {
      closed = true;
      while (waiting.length) waiting.shift().reject(new CancelledError({ eof: true }));
    });
    // Ctrl+C：無論在輸入或讀取資料中，都強制結束程式。
    rl.on('SIGINT', () => {
      process.stdout.write('^C\n');
      try {
        onInterrupt?.();
      } finally {
        closePrompt(); // 還原終端機模式
        process.exit(130);
      }
    });
  }
  return rl;
}

export function closePrompt() {
  if (rl) {
    rl.close();
    rl = null;
  }
}

export function canPrompt() {
  return Boolean(process.stdin.isTTY);
}

/** 目前 session 的指令歷史（新的在前）。 */
export function promptHistory() {
  return rl ? [...rl.history] : [];
}

export async function ask(question, { defaultValue, record = false } = {}) {
  const iface = getInterface();
  const suffix = defaultValue !== undefined && defaultValue !== '' ? c.gray(` [${defaultValue}]`) : '';
  if (closed) {
    // 管線輸入已讀完、介面已關閉，但可能還有排隊中的行。
    process.stdout.write(`${question}${suffix} `);
  } else {
    iface.setPrompt(`${question}${suffix} `);
    iface.prompt();
  }
  let answer;
  if (queued.length) {
    answer = queued.shift();
    if (!process.stdin.isTTY) process.stdout.write(`${answer}\n`);
  } else if (closed) {
    throw new CancelledError({ eof: true });
  } else {
    answer = await new Promise((resolve, reject) => waiting.push({ resolve, reject }));
    if (!process.stdin.isTTY) process.stdout.write(`${answer}\n`);
  }
  // 只有 shell 的指令列要留在上下鍵歷史中，欄位輸入不要。
  if (!record && iface.history && iface.history[0] === answer) iface.history.shift();
  const trimmed = answer.trim();
  return trimmed === '' && defaultValue !== undefined ? String(defaultValue) : trimmed;
}

export async function confirm(question, { defaultYes = false } = {}) {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  const answer = (await ask(`${question} ${c.gray(`(${hint})`)}`)).toLowerCase();
  if (!answer) return defaultYes;
  return ['y', 'yes', '是', '好'].includes(answer);
}

/** 以編號選擇；回傳選到的 value，輸入空白或 q 回傳 null。 */
export async function choose(question, choices, { allowBack = true } = {}) {
  choices.forEach((opt, i) => {
    const num = c.cyan(String(i + 1).padStart(2, ' '));
    process.stdout.write(`  ${num}. ${opt.label}${opt.hint ? c.gray(`  ${opt.hint}`) : ''}\n`);
  });
  if (allowBack) process.stdout.write(`  ${c.cyan(' 0')}. ${c.gray('返回 / 離開')}\n`);
  for (;;) {
    const answer = (await ask(question)).trim();
    if (answer === '' || answer === '0' || answer.toLowerCase() === 'q') return null;
    const n = Number(answer);
    if (Number.isInteger(n) && n >= 1 && n <= choices.length) return choices[n - 1].value;
    const match = choices.find((o) => String(o.value).toLowerCase() === answer.toLowerCase());
    if (match) return match.value;
    process.stdout.write(c.yellow(`請輸入 1-${choices.length} 的數字。\n`));
  }
}
