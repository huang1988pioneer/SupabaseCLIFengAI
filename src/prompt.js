// 互動式輸入工具（readline）。
import readline from 'node:readline';
import { c } from './ui.js';

let rl = null;
const queued = [];
const waiting = [];
let closed = false;

// 使用 line 事件自行排隊，讓管線輸入（非 TTY）也能逐行讀取。
function getInterface() {
  if (!rl) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
    rl.on('line', (line) => {
      const next = waiting.shift();
      if (next) next.resolve(line);
      else queued.push(line);
    });
    rl.on('close', () => {
      closed = true;
      while (waiting.length) waiting.shift().reject(new CancelledError());
    });
    rl.on('SIGINT', () => {
      rl.close();
    });
  }
  return rl;
}

export class CancelledError extends Error {
  constructor() {
    super('已取消');
    this.name = 'CancelledError';
  }
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

export async function ask(question, { defaultValue } = {}) {
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
    throw new CancelledError();
  } else {
    answer = await new Promise((resolve, reject) => waiting.push({ resolve, reject }));
    if (!process.stdin.isTTY) process.stdout.write(`${answer}\n`);
  }
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
export async function choose(question, options, { allowBack = true } = {}) {
  options.forEach((opt, i) => {
    const num = c.cyan(String(i + 1).padStart(2, ' '));
    process.stdout.write(`  ${num}. ${opt.label}${opt.hint ? c.gray(`  ${opt.hint}`) : ''}\n`);
  });
  if (allowBack) process.stdout.write(`  ${c.cyan(' 0')}. ${c.gray('返回 / 離開')}\n`);
  for (;;) {
    const answer = (await ask(question)).trim();
    if (answer === '' || answer === '0' || answer.toLowerCase() === 'q') return null;
    const n = Number(answer);
    if (Number.isInteger(n) && n >= 1 && n <= options.length) return options[n - 1].value;
    const match = options.find((o) => String(o.value).toLowerCase() === answer.toLowerCase());
    if (match) return match.value;
    process.stdout.write(c.yellow(`請輸入 1-${options.length} 的數字。\n`));
  }
}
