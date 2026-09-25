// 首頁（今日工作台）與儀表（總覽）。
import { c, banner, catBanner, showCatBanner, heading, section, table, withSpinner, badge, strWidth, pad } from '../ui.js';
import { MODULES, findModule, isBankAccount, isPointsItem } from '../modules.js';
import { daysUntil, formatDate, formatDays, formatMoney, formatNumber, toTwd, today } from '../util.js';
import { displayName } from '../config.js';
import { friendlyError } from '../supabase.js';

async function safeSelect(ctx, table, opts) {
  try {
    return { rows: await ctx.client.select(table, opts), error: null };
  } catch (err) {
    return { rows: [], error: friendlyError(err, table) };
  }
}

export function subscriptionAlerts(subs, now = new Date()) {
  const out = { overdue: [], critical: [], warning: [], cancel: [] };
  for (const s of subs) {
    const days = daysUntil(s.nextdate, now);
    if (days === null) continue;
    const item = { ...s, days };
    if (s.iscontinue === false) {
      if (days >= 0 && days <= 7) out.cancel.push(item);
      continue;
    }
    if (days < 0 && days >= -30) out.overdue.push(item);
    else if (days >= 0 && days <= 3) out.critical.push(item);
    else if (days > 3 && days <= 7) out.warning.push(item);
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.days - b.days);
  return out;
}

export function foodAlerts(foods, now = new Date()) {
  const out = { expired: [], critical: [], warning: [], low: [] };
  for (const f of foods) {
    const days = daysUntil(f.todate, now);
    const item = { ...f, days };
    if (days !== null) {
      if (days < 0) out.expired.push(item);
      else if (days <= 7) out.critical.push(item);
      else if (days <= 30) out.warning.push(item);
    }
    if (f.amount !== null && f.amount !== undefined && Number(f.amount) <= 1 && (days === null || days >= 0)) out.low.push(item);
  }
  for (const key of ['expired', 'critical', 'warning']) out[key].sort((a, b) => a.days - b.days);
  return out;
}

const itemLine = (name, right, color = (t) => t) => `    ${color('•')} ${name}${right ? c.gray(`  ${right}`) : ''}`;

export async function homeCommand(ctx, args, flags) {
  if (showCatBanner(flags)) ctx.print(catBanner());
  const [subs, foods] = await withSpinner('整理今日工作台…', () =>
    Promise.all([safeSelect(ctx, 'subscription', { order: 'nextdate.asc.nullslast' }), safeSelect(ctx, 'food', { order: 'todate.asc.nullslast' })]),
  );
  const sa = subscriptionAlerts(subs.rows);
  const fa = foodAlerts(foods.rows);

  if (flags.json) {
    return ctx.printJson({ date: today(), subscription: sa, food: fa, errors: [subs.error, foods.error].filter(Boolean) });
  }

  ctx.print(c.gray('FENG BRO / HOME SIGNAL'));
  ctx.print(banner());
  ctx.print('');
  ctx.print(c.gray(`今日工作台 · ${today()} · ${displayName(ctx.source)}`));
  ctx.print(`${c.bold('先處理今天，')}${c.bold(c.green('再安心安排接下來的日常。'))}`);

  // A1 訂閱
  ctx.print(section(`${c.cyan('A1')} 訂閱`));
  if (subs.error) ctx.print(c.red(`  ${subs.error}`));
  else {
    const total = sa.overdue.length + sa.critical.length + sa.warning.length + sa.cancel.length;
    if (!total) ctx.print(c.green('  ✓ 7 天內沒有需要處理的訂閱'));
    const group = (title, list, level) => {
      if (!list.length) return;
      ctx.print(`  ${badge(`${title} ${list.length}`, level)}`);
      list.slice(0, 8).forEach((s) => ctx.print(itemLine(s.name, `${formatDate(s.nextdate)} · ${formatDays(s.days)}${s.price ? ` · ${formatMoney(s.price, s.currency)}` : ''}`)));
      if (list.length > 8) ctx.print(c.gray(`    … 還有 ${list.length - 8} 筆`));
    };
    group('3 天內到期', sa.critical, 'critical');
    group('7 天內到期', sa.warning, 'warning');
    group('已過期（30 天內）', sa.overdue, 'muted');
    group('已停止續訂但即將扣款，確認是否取消', sa.cancel, 'info');
  }

  // B2 食品
  ctx.print(section(`${c.cyan('B2')} 食品`));
  if (foods.error) ctx.print(c.red(`  ${foods.error}`));
  else {
    const total = fa.expired.length + fa.critical.length + fa.low.length;
    if (!total) ctx.print(c.green('  ✓ 沒有即將過期或數量不足的食品'));
    const group = (title, list, level, right) => {
      if (!list.length) return;
      ctx.print(`  ${badge(`${title} ${list.length}`, level)}`);
      list.slice(0, 8).forEach((f) => ctx.print(itemLine(f.name, right(f))));
      if (list.length > 8) ctx.print(c.gray(`    … 還有 ${list.length - 8} 筆`));
    };
    group('7 天內到期', fa.critical, 'critical', (f) => `${formatDate(f.todate)} · ${formatDays(f.days)} · 數量 ${f.amount ?? 0}`);
    group('已過期', fa.expired, 'muted', (f) => `${formatDate(f.todate)} · ${formatDays(f.days)}`);
    group('數量不足（≤1），安排補貨', fa.low, 'warning', (f) => `數量 ${f.amount ?? 0}${f.shop ? ` · ${f.shop}` : ''}`);
  }

  ctx.print(section('快速新增與處理'));
  const quick = [
    ['fengbro3 dashboard', '總覽：費用、到期項目與資料狀態'],
    ['fengbro3 subscription', '訂閱管理：平台費用、付款時間與續訂節奏'],
    ['fengbro3 trial', '試用／首購：依服務展開帳號與扣款日'],
    ['fengbro3 food due', '食品：30 天內到期清單'],
    ['fengbro3 <模組> add', '新增資料（不帶參數會逐欄詢問）'],
    ['fengbro3 menu', '互動式選單'],
  ];
  const w = Math.max(...quick.map(([k]) => strWidth(k)));
  quick.forEach(([cmd, desc]) => ctx.print(`  ${c.green(pad(cmd, w))}  ${c.gray(desc)}`));
  ctx.print('');
}

export async function dashboardCommand(ctx, args, flags) {
  const wanted = ['subscription', 'food', 'trial-purchase', 'quota', 'bank'].map(findModule);
  const [subs, foods, trials, quotas, banks, counts] = await withSpinner('載入儀表資料…', () =>
    Promise.all([
      ...wanted.map((m) => safeSelect(ctx, m.table, { order: m.order })),
      Promise.all(
        MODULES.map(async (m) => {
          try {
            return { mod: m, count: await ctx.client.count(m.table) };
          } catch (err) {
            return { mod: m, count: null, error: friendlyError(err, m.table) };
          }
        }),
      ),
    ]),
  );

  const sa = subscriptionAlerts(subs.rows);
  const fa = foodAlerts(foods.rows);
  const monthlyRaw = subs.rows.reduce((s, r) => s + (Number(r.price) || 0), 0);
  const monthlyTwd = subs.rows.filter((r) => r.iscontinue !== false).reduce((s, r) => s + toTwd(r.price, r.currency), 0);
  const sum = (list) => list.reduce((s, r) => s + (Number(r.deposit) || 0), 0);
  const bankRows = banks.rows.filter(isBankAccount);
  const pointRows = banks.rows.filter(isPointsItem);
  const ticketRows = banks.rows.filter((r) => !isBankAccount(r) && !isPointsItem(r));

  const data = {
    date: today(),
    subscriptions: { count: subs.rows.length, critical: sa.critical.length, warning: sa.warning.length, monthlyTotal: monthlyRaw, activeMonthlyTwd: monthlyTwd },
    foods: { count: foods.rows.length, critical: fa.critical.length, warning: fa.warning.length, expired: fa.expired.length },
    trialPurchase: {
      services: new Set(trials.rows.map((r) => r.name)).size,
      accounts: trials.rows.length,
      untried: trials.rows.filter((r) => r.trialstatus !== 'tried').length,
      notPurchased: trials.rows.filter((r) => r.purchasestatus === 'not_purchased').length,
    },
    quota: { accounts: quotas.rows.length, ai: quotas.rows.filter((r) => r.servicetype === 'ai').length },
    bank: {
      bankAccounts: bankRows.length,
      bankTotal: sum(bankRows),
      tickets: ticketRows.length,
      ticketTotal: sum(ticketRows),
      points: pointRows.length,
      pointsTotal: sum(pointRows),
    },
    tables: Object.fromEntries(counts.map((x) => [x.mod.table, x.count])),
  };
  if (flags.json) return ctx.printJson(data);

  ctx.print(heading('鋒兄儀表', '快速查看費用、到期項目與資料狀態。'));

  const cards = [
    ['訂閱總數', `${formatNumber(data.subscriptions.count)} 項`, [sa.critical.length && c.red(`${sa.critical.length} 項 3天內到期`), sa.warning.length && c.yellow(`${sa.warning.length} 項 7天內到期`)]],
    ['食物庫存', `${formatNumber(data.foods.count)} 項`, [fa.critical.length && c.red(`${fa.critical.length} 項 7天內到期`), fa.warning.length && c.yellow(`${fa.warning.length} 項 30天內到期`)]],
    ['每月費用', `NT$ ${formatNumber(monthlyRaw)}`, [c.gray(`續訂中換算台幣 NT$ ${formatNumber(monthlyTwd)}`)]],
    ['銀行資產', `NT$ ${formatNumber(data.bank.bankTotal)}`, [c.gray(`${data.bank.bankAccounts} 個帳戶 · 票證 NT$ ${formatNumber(data.bank.ticketTotal)} · 點數 ${formatNumber(data.bank.pointsTotal)}`)]],
    ['試用／首購', `${data.trialPurchase.services} 個服務`, [c.gray(`尚未試用 ${data.trialPurchase.untried} · 未首購 ${data.trialPurchase.notPurchased}`)]],
    ['額度', `${data.quota.accounts} 個帳號`, [c.gray(`AI 服務 ${data.quota.ai}`)]],
  ];
  ctx.print('');
  const lw = Math.max(...cards.map(([t]) => strWidth(t)));
  const vw = Math.max(...cards.map(([, v]) => strWidth(v)));
  cards.forEach(([title, value, notes]) => {
    ctx.print(`  ${c.gray(pad(title, lw))}  ${c.bold(pad(value, vw))}  ${notes.filter(Boolean).join(c.gray(' · '))}`);
  });

  const alertRows = [
    ...sa.critical.map((s) => ({ ...s, type: '訂閱', level: 'critical' })),
    ...sa.warning.map((s) => ({ ...s, type: '訂閱', level: 'warning' })),
    ...fa.critical.map((f) => ({ ...f, nextdate: f.todate, type: '食品', level: 'critical' })),
    ...fa.warning.map((f) => ({ ...f, nextdate: f.todate, type: '食品', level: 'warning' })),
  ].sort((a, b) => a.days - b.days);
  ctx.print(section('到期提醒'));
  ctx.print(
    alertRows.length
      ? table(alertRows, [
          { key: 'type', label: '類型' },
          { key: 'name', label: '名稱', max: 36 },
          { key: 'nextdate', label: '日期', format: (r) => formatDate(r.nextdate) },
          { key: 'days', label: '剩餘', format: (r) => formatDays(r.days), color: (r, t) => (r.level === 'critical' ? c.red(t) : c.yellow(t)) },
          { key: 'extra', label: '金額／數量', align: 'right', format: (r) => (r.type === '訂閱' ? (r.price ? formatMoney(r.price, r.currency) : '') : `數量 ${r.amount ?? 0}`) },
        ])
      : c.green('✓ 目前沒有到期提醒'),
  );

  ctx.print(section('資料狀態'));
  ctx.print(
    table(counts, [
      { key: 'name', label: '模組', format: (x) => x.mod.name },
      { key: 'table', label: '資料表', format: (x) => x.mod.table, color: (x, t) => c.gray(t) },
      { key: 'count', label: '筆數', align: 'right', format: (x) => (x.count === null ? '—' : formatNumber(x.count)) },
      { key: 'status', label: '狀態', format: (x) => (x.error ? x.error : '正常'), color: (x, t) => (x.error ? c.red(t) : c.green(t)) },
    ]),
  );
  ctx.print('');
}
