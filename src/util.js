// 日期、金額等共用工具（邏輯對應網頁版）。

export const CURRENCIES = [
  { value: 'TWD', label: '台幣' },
  { value: 'USD', label: '美元' },
  { value: 'JPY', label: '日圓' },
  { value: 'CNY', label: '人民幣' },
];

// 網頁版固定匯率（換算成台幣）。
export const RATES = { TWD: 1, USD: 35, JPY: 0.35, CNY: 4.5 };
const SYMBOLS = { TWD: 'NT$', USD: '$', JPY: '¥', CNY: '¥' };

export function toTwd(amount, currency = 'TWD') {
  return Math.round((Number(amount) || 0) * (RATES[currency] || 1));
}

/** 例：NT$ 350 ($ 10) */
export function formatMoney(amount, currency = 'TWD') {
  if (amount === null || amount === undefined || amount === '') return '';
  const n = Number(amount) || 0;
  if (!currency || currency === 'TWD') return `NT$ ${n.toLocaleString('en-US')}`;
  const symbol = SYMBOLS[currency] || currency;
  return `NT$ ${toTwd(n, currency).toLocaleString('en-US')} (${symbol} ${n.toLocaleString('en-US')})`;
}

export function formatNumber(n) {
  return (Number(n) || 0).toLocaleString('en-US');
}

/** 以本地時區取得 YYYY-MM-DD */
export function today(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDay(value) {
  if (!value) return null;
  const [y, m, d] = String(value).split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d);
}

/** 距離今天的天數；負數代表已過期。 */
export function daysUntil(value, now = new Date()) {
  const target = parseDay(value);
  if (target === null) return null;
  const base = parseDay(today(now));
  return Math.round((target - base) / 86400000);
}

export function daysBetween(a, b) {
  const x = parseDay(a);
  const y = parseDay(b);
  if (x === null || y === null) return null;
  return Math.abs(Math.round((y - x) / 86400000));
}

export function formatDays(days) {
  if (days === null || days === undefined) return '';
  if (days < 0) return `已過期 ${Math.abs(days)} 天`;
  if (days === 0) return '今天';
  if (days === 1) return '明天';
  return `${days} 天後`;
}

export function formatDate(value) {
  if (!value) return '';
  return String(value).split('T')[0];
}

export function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${today(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** 把「今天 / +7 / -3 / 2026-1-5」轉成 YYYY-MM-DD */
export function parseDateInput(input, now = new Date()) {
  const raw = String(input).trim();
  if (!raw) return null;
  if (raw === 'today' || raw === '今天') return today(now);
  if (raw === 'tomorrow' || raw === '明天') return today(new Date(now.getTime() + 86400000));
  if (raw === 'yesterday' || raw === '昨天') return today(new Date(now.getTime() - 86400000));
  const rel = raw.match(/^([+-])(\d+)([dwmy]?)$/i);
  if (rel) {
    const n = Number(rel[2]) * (rel[1] === '-' ? -1 : 1);
    const d = new Date(now);
    const unit = (rel[3] || 'd').toLowerCase();
    if (unit === 'd') d.setDate(d.getDate() + n);
    if (unit === 'w') d.setDate(d.getDate() + n * 7);
    if (unit === 'm') d.setMonth(d.getMonth() + n);
    if (unit === 'y') d.setFullYear(d.getFullYear() + n);
    return today(d);
  }
  const m = raw.replace(/[/.]/g, '-').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const value = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    if (isValidDate(value)) return value;
  }
  throw new Error(`日期格式不正確：「${raw}」（請用 YYYY-MM-DD、today、明天、+7；none 清空）`);
}

export function parseBool(input) {
  if (typeof input === 'boolean') return input;
  const v = String(input).trim().toLowerCase();
  if (['true', 'yes', 'y', '1', 'on', '是', '續訂'].includes(v)) return true;
  if (['false', 'no', 'n', '0', 'off', '否', '停止', '取消'].includes(v)) return false;
  throw new Error(`布林值不正確：「${input}」（請用 true / false）`);
}

export function normalize(text) {
  return String(text ?? '').trim().toLowerCase();
}
