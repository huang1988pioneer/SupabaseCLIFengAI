// 終端機輸出工具：顏色、CJK 寬度計算、表格與區塊。

const env = process.env;
let colorEnabled = Boolean(process.stdout.isTTY) && !('NO_COLOR' in env) && env.TERM !== 'dumb';
if (env.FORCE_COLOR && env.FORCE_COLOR !== '0') colorEnabled = true;

export function setColor(enabled) {
  colorEnabled = enabled;
}

const wrap = (open, close) => (text) => (colorEnabled ? `\x1b[${open}m${text}\x1b[${close}m` : String(text));

export const c = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  italic: wrap(3, 23),
  underline: wrap(4, 24),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  magenta: wrap(35, 39),
  cyan: wrap(36, 39),
  gray: wrap(90, 39),
  brightGreen: wrap(92, 39),
  inverse: wrap(7, 27),
};

const ANSI_RE = /\x1b\[[0-9;]*m/g;

export function stripAnsi(text) {
  return String(text).replace(ANSI_RE, '');
}

function isWide(cp) {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0x303e) ||
    (cp >= 0x3041 && cp <= 0x33ff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xa000 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1f64f) ||
    (cp >= 0x1f900 && cp <= 0x1f9ff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  );
}

function charWidth(ch) {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return 0;
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return 0;
  if (cp >= 0x300 && cp <= 0x36f) return 0; // 組合用附加符號
  if (cp === 0x200b || cp === 0xfe0f) return 0;
  return isWide(cp) ? 2 : 1;
}

export function strWidth(text) {
  let width = 0;
  for (const ch of stripAnsi(text)) width += charWidth(ch);
  return width;
}

export function truncate(text, max) {
  const plain = String(text ?? '');
  if (max <= 0) return '';
  if (strWidth(plain) <= max) return plain;
  let out = '';
  let width = 0;
  for (const ch of stripAnsi(plain)) {
    const w = charWidth(ch);
    if (width + w > max - 1) break;
    out += ch;
    width += w;
  }
  return `${out}…`;
}

export function pad(text, width, align = 'left') {
  const gap = Math.max(0, width - strWidth(text));
  return align === 'right' ? ' '.repeat(gap) + text : text + ' '.repeat(gap);
}

export function termWidth() {
  return process.stdout.columns || Number(process.env.COLUMNS) || 100;
}

/**
 * 繪製表格。columns: [{ key, label, align, max, format(row) => string, color(row, text) => string }]
 */
export function table(rows, columns, { maxWidth = termWidth() } = {}) {
  if (!rows.length) return c.dim('（沒有資料）');
  const cells = rows.map((row) =>
    columns.map((col) => {
      const raw = col.format ? col.format(row) : row[col.key];
      const text = raw === null || raw === undefined ? '' : String(raw).replace(/\s+/g, ' ').trim();
      return col.max ? truncate(text, col.max) : text;
    }),
  );
  const widths = columns.map((col, i) =>
    Math.max(strWidth(col.label), ...cells.map((r) => strWidth(r[i]))),
  );

  // 太寬時，先壓縮文字欄（有設定 max 的欄位），不夠再壓縮其他欄位；每次壓縮最寬的一欄。
  const sep = 2;
  const total = () => widths.reduce((a, b) => a + b, 0) + sep * (widths.length - 1);
  for (const flexibleOnly of [true, false]) {
    while (total() > maxWidth) {
      let idx = -1;
      widths.forEach((w, i) => {
        if (flexibleOnly && !columns[i].max) return;
        if (w > 6 && (idx < 0 || w > widths[idx])) idx = i;
      });
      if (idx < 0) break;
      widths[idx] -= 1;
    }
  }

  const lines = [];
  lines.push(c.bold(columns.map((col, i) => pad(truncate(col.label, widths[i]), widths[i], col.align)).join(' '.repeat(sep)).trimEnd()));
  lines.push(c.gray(widths.map((w) => '─'.repeat(w)).join(' '.repeat(sep))));
  cells.forEach((r, ri) => {
    lines.push(
      columns
        .map((col, i) => {
          const text = pad(truncate(r[i], widths[i]), widths[i], col.align);
          return col.color ? col.color(rows[ri], text) : text;
        })
        .join(' '.repeat(sep))
        .trimEnd(),
    );
  });
  return lines.join('\n');
}

/** key-value 詳細資料 */
export function details(pairs) {
  const visible = pairs.filter(([, v]) => v !== undefined);
  const labelWidth = Math.max(...visible.map(([k]) => strWidth(k)), 0);
  return visible
    .map(([k, v]) => {
      const value = v === null || v === '' ? c.dim('—') : String(v);
      const lines = value.split('\n');
      const indent = ' '.repeat(labelWidth + 2);
      return `${c.gray(pad(k, labelWidth))}  ${lines[0]}${lines.slice(1).map((l) => `\n${indent}${l}`).join('')}`;
    })
    .join('\n');
}

export function heading(title, subtitle) {
  const lines = [c.bold(c.green(title))];
  if (subtitle) lines.push(c.gray(subtitle));
  return lines.join('\n');
}

export function section(title) {
  return `\n${c.bold(title)}\n${c.gray('─'.repeat(Math.min(strWidth(title) + 8, termWidth())))}`;
}

export function badge(text, level) {
  const map = { critical: c.red, warning: c.yellow, success: c.green, info: c.cyan, muted: c.gray };
  return (map[level] || ((t) => t))(`[${text}]`);
}

export const BANNER = [
  '███████╗███████╗███╗   ██╗ ██████╗     ██████╗ ██████╗  ██████╗',
  '██╔════╝██╔════╝████╗  ██║██╔════╝     ██╔══██╗██╔══██╗██╔═══██╗',
  '█████╗  █████╗  ██╔██╗ ██║██║  ███╗    ██████╔╝██████╔╝██║   ██║',
  '██╔══╝  ██╔══╝  ██║╚██╗██║██║   ██║    ██╔══██╗██╔══██╗██║   ██║',
  '██║     ███████╗██║ ╚████║╚██████╔╝    ██████╔╝██║  ██║╚██████╔╝',
  '╚═╝     ╚══════╝╚═╝  ╚═══╝ ╚═════╝     ╚═════╝ ╚═╝  ╚═╝ ╚═════╝',
];

export function banner() {
  if (termWidth() < 66) return c.bold(c.green('FENG BRO'));
  return BANNER.map((l) => c.green(l)).join('\n');
}

export class Spinner {
  constructor(text) {
    this.text = text;
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.i = 0;
    this.timer = null;
  }

  start() {
    if (!process.stderr.isTTY || !colorEnabled) return this;
    this.timer = setInterval(() => {
      process.stderr.write(`\r${c.cyan(this.frames[(this.i += 1) % this.frames.length])} ${this.text}`);
    }, 80);
    return this;
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      process.stderr.write(`\r${' '.repeat(strWidth(this.text) + 4)}\r`);
    }
  }
}

export async function withSpinner(text, fn) {
  const spinner = new Spinner(text).start();
  try {
    return await fn();
  } finally {
    spinner.stop();
  }
}
