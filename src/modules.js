// 模組定義：與網頁版側欄相同的分類、資料表與欄位。
import { c } from './ui.js';
import { CURRENCIES, daysUntil, formatDate, formatDays, formatMoney, formatNumber, daysBetween, toTwd } from './util.js';

const TRIAL_STATUS = [
  { value: 'untried', label: '尚未試用' },
  { value: 'tried', label: '已試用' },
];
const PURCHASE_STATUS = [
  { value: 'not_purchased', label: '未首購' },
  { value: 'purchased', label: '已首購' },
  { value: 'unavailable', label: '無提供首購' },
];
const SYSTEMS = [
  { value: 'win', label: 'Windows' },
  { value: 'mac', label: 'Mac' },
];
const SOFTWARE_TYPES = [
  { value: 'trial', label: '試用軟體' },
  { value: 'free', label: '免費軟體' },
  { value: 'paid', label: '付費軟體' },
];
const LICENSE_TYPES = [
  { value: 'none', label: '無序號' },
  { value: 'paid_serial', label: '付費序號' },
];
const PERIODS = [
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
];
const SERVICE_TYPES = [
  { value: 'general', label: '一般' },
  { value: 'ai', label: 'AI 服務' },
];
export const PICKUP_PRESETS = ['門市購買', '超商取貨付款', '蝦皮取貨付款', '宅配/郵寄', '超商取貨', '蝦皮取貨', '門市取貨'];

const BANK_KEYWORDS = ['台北富邦', '富邦', '國泰世華', '國泰', '兆豐', '王道', '新光', '中華郵政', '郵局', '玉山', '中國信託', '中信', '台新', '臺新', '永豐', '第一銀行', '一銀', '華南', '彰化銀行', '彰銀', '土地銀行', '土銀', '合作金庫', '合庫', '臺灣銀行', '台灣銀行', '台銀', '上海商銀', '上海銀行', '聯邦', '遠東商銀', '遠銀', '元大', '凱基', '星展', '渣打', '滙豐', '匯豐', '陽信', '三信', '高雄銀行', '臺灣企銀', '台灣企銀', '企銀', '農會', '漁會', '信用合作社', '信合社', '銀行', '信託'];
const POINT_KEYWORDS = ['點數', 'point', '紅利', '里程', '哩程'];

export function isPointsItem(row) {
  const name = String(row.name || '').trim().toLowerCase();
  return Boolean(name) && POINT_KEYWORDS.some((k) => name.includes(k));
}

export function isBankAccount(row) {
  const name = String(row.name || '').trim().toLowerCase();
  if (!name || isPointsItem(row)) return false;
  return BANK_KEYWORDS.some((k) => name.includes(k.toLowerCase()));
}

export function bankKind(row) {
  if (isPointsItem(row)) return '點數';
  if (isBankAccount(row)) return '銀行';
  return '電子票證';
}

const labelOf = (options, value) => options.find((o) => o.value === value)?.label ?? value ?? '';

// ---------- 欄位工廠 ----------
const text = (key, label, extra = {}) => ({ key, label, type: 'text', ...extra });
const longtext = (key, label, extra = {}) => ({ key, label, type: 'longtext', ...extra });
const int = (key, label, extra = {}) => ({ key, label, type: 'int', ...extra });
const date = (key, label, extra = {}) => ({ key, label, type: 'date', ...extra });
const datetime = (key, label, extra = {}) => ({ key, label, type: 'datetime', ...extra });
const bool = (key, label, extra = {}) => ({ key, label, type: 'bool', ...extra });
const choice = (key, label, options, extra = {}) => ({ key, label, type: 'enum', options, ...extra });

const dayColor = (days, critical, warning) => (row, t) => {
  const d = days(row);
  if (d === null) return c.dim(t);
  if (d < 0) return c.gray(t);
  if (d <= critical) return c.red(t);
  if (d <= warning) return c.yellow(t);
  return t;
};

const mediaFields = ({ lyrics = false, noteMax = 100, filetype = true } = {}) => [
  text('name', '名稱', { required: true, max: 100 }),
  text('file', '檔案', { max: 150, media: true }),
  ...(filetype ? [text('filetype', '格式', { max: 20 })] : []),
  text('category', '分類', { max: 100 }),
  ...(lyrics ? [text('language', '語言', { max: 100 }), longtext('lyrics', '歌詞')] : []),
  text('note', '備註', { max: noteMax }),
  text('ref', '參考', { max: 100 }),
  text('hash', 'Hash', { max: 300, hidden: true }),
  text('cover', '封面', { max: 150, media: true }),
];

const mediaColumns = (extra = []) => [
  { key: 'name', label: '名稱', max: 40 },
  { key: 'category', label: '分類', max: 12 },
  ...extra,
  { key: 'filetype', label: '格式', max: 6 },
  { key: 'created_at', label: '建立', format: (r) => formatDate(r.created_at) },
];

const commonSiteFields = [];
for (let i = 1; i <= 37; i += 1) {
  const n = String(i).padStart(2, '0');
  commonSiteFields.push(text(`site${n}`, `網站${n}`, { max: 100, hidden: true }));
  commonSiteFields.push(text(`note${n}`, `備註${n}`, { max: 100, hidden: true }));
}
const commonPairs = (row) => {
  const pairs = [];
  for (let i = 1; i <= 37; i += 1) {
    const n = String(i).padStart(2, '0');
    if (row[`site${n}`] || row[`note${n}`]) pairs.push({ n, site: row[`site${n}`] || '', note: row[`note${n}`] || '' });
  }
  return pairs;
};

export const GROUPS = [
  { id: 'daily', name: '日常管理', subtitle: '管理訂閱、食品與例行事項。' },
  { id: 'content', name: '內容中心', subtitle: '集中管理筆記、文件與媒體。' },
  { id: 'finance', name: '財務與帳號', subtitle: '管理銀行紀錄與常用帳號。' },
];

export const MODULES = [
  {
    id: 'subscription',
    aliases: ['sub', 'subs', '訂閱'],
    group: 'daily',
    table: 'subscription',
    name: '訂閱',
    title: '鋒兄訂閱',
    subtitle: '管理付款、續訂與到期日。',
    order: 'nextdate.asc.nullslast',
    fields: [
      text('name', '名稱', { required: true, max: 100 }),
      text('site', '網站'),
      text('account', '帳號'),
      int('price', '價格'),
      choice('currency', '幣別', CURRENCIES, { default: 'TWD' }),
      date('nextdate', '下次扣款'),
      bool('iscontinue', '續訂', { default: true }),
      longtext('note', '備註'),
    ],
    columns: [
      { key: 'name', label: '名稱', max: 32 },
      { key: 'price', label: '費用', align: 'right', format: (r) => formatMoney(r.price, r.currency) },
      { key: 'nextdate', label: '下次扣款', format: (r) => formatDate(r.nextdate) },
      {
        key: 'days',
        label: '剩餘',
        format: (r) => formatDays(daysUntil(r.nextdate)),
        color: dayColor((r) => daysUntil(r.nextdate), 3, 7),
      },
      {
        key: 'iscontinue',
        label: '續訂',
        format: (r) => (r.iscontinue === false ? '停止' : '續訂'),
        color: (r, t) => (r.iscontinue === false ? c.gray(t) : c.green(t)),
      },
      { key: 'account', label: '帳號', max: 24 },
    ],
    search: ['name', 'site', 'account', 'note'],
    summary(rows) {
      const active = rows.filter((r) => r.iscontinue !== false);
      const total = rows.reduce((sum, r) => sum + (Number(r.price) || 0), 0);
      return `續訂中 ${active.length} 筆，費用合計 NT$ ${formatNumber(total)}（原幣加總，同網頁版）`;
    },
  },
  {
    id: 'trial-purchase',
    aliases: ['trial', 'trialpurchase', '試用', '首購'],
    group: 'daily',
    table: 'trialpurchase',
    name: '試用/首購',
    title: '鋒兄試用/首購',
    subtitle: '依服務展開帳號、試用與首購狀態。',
    order: 'name.asc,created_at.desc',
    fields: [
      text('name', '服務', { required: true, max: 100 }),
      text('account', '帳號', { max: 200 }),
      date('eventdate', '試用/首購/到期日'),
      int('firstpurchaseprice', '首購價'),
      int('regularprice', '原價'),
      choice('trialstatus', '試用狀態', TRIAL_STATUS, { default: 'untried' }),
      choice('purchasestatus', '首購狀態', PURCHASE_STATUS, { default: 'not_purchased' }),
      longtext('note', '備註', { max: 3337 }),
    ],
    columns: [
      { key: 'name', label: '服務', max: 24 },
      { key: 'account', label: '帳號', max: 28 },
      { key: 'eventdate', label: '日期', format: (r) => formatDate(r.eventdate) },
      {
        key: 'trialstatus',
        label: '試用',
        format: (r) => labelOf(TRIAL_STATUS, r.trialstatus),
        color: (r, t) => (r.trialstatus === 'tried' ? c.gray(t) : c.yellow(t)),
      },
      {
        key: 'purchasestatus',
        label: '首購',
        format: (r) => labelOf(PURCHASE_STATUS, r.purchasestatus),
        color: (r, t) => (r.purchasestatus === 'purchased' ? c.green(t) : r.purchasestatus === 'unavailable' ? c.gray(t) : c.yellow(t)),
      },
      { key: 'price', label: '首購/原價', align: 'right', format: (r) => `${formatNumber(r.firstpurchaseprice)} / ${formatNumber(r.regularprice)}` },
    ],
    search: ['name', 'account', 'note'],
    summary(rows) {
      const services = new Set(rows.map((r) => r.name)).size;
      const untried = rows.filter((r) => r.trialstatus !== 'tried').length;
      const notPurchased = rows.filter((r) => r.purchasestatus === 'not_purchased').length;
      return `${services} 個服務、${rows.length} 個帳號；尚未試用 ${untried}、未首購 ${notPurchased}`;
    },
  },
  {
    id: 'reinstall',
    aliases: ['重灌', 'software'],
    group: 'daily',
    table: 'reinstall',
    name: '重灌',
    title: '鋒兄重灌',
    subtitle: '整理 Windows／Mac 重灌軟體、序號與訂閱費用。',
    order: 'system.asc,name.asc',
    fields: [
      text('name', '軟體名稱', { required: true, max: 100 }),
      choice('system', '系統', SYSTEMS, { default: 'win' }),
      choice('softwaretype', '軟體類型', SOFTWARE_TYPES, { default: 'free' }),
      choice('licensetype', '授權方式', LICENSE_TYPES, { default: 'none' }),
      text('serial', '序號', { max: 500, secret: true }),
      text('viewpassword', '查看密碼', { max: 100, secret: true }),
      bool('subscriptionsoftware', '訂閱制', { default: false }),
      choice('subscriptionperiod', '訂閱週期', PERIODS),
      int('subscriptionprice', '訂閱費用'),
      choice('subscriptioncurrency', '訂閱幣別', CURRENCIES, { default: 'TWD' }),
      text('site', '網站'),
      longtext('note', '備註', { max: 3337 }),
    ],
    columns: [
      { key: 'system', label: '系統', format: (r) => labelOf(SYSTEMS, r.system) },
      { key: 'name', label: '軟體', max: 30 },
      { key: 'softwaretype', label: '類型', format: (r) => labelOf(SOFTWARE_TYPES, r.softwaretype) },
      { key: 'licensetype', label: '授權', format: (r) => labelOf(LICENSE_TYPES, r.licensetype) },
      {
        key: 'subscription',
        label: '訂閱',
        format: (r) =>
          r.subscriptionsoftware
            ? `${formatMoney(r.subscriptionprice, r.subscriptioncurrency)}/${labelOf(PERIODS, r.subscriptionperiod) || '期'}`
            : '',
      },
      { key: 'site', label: '網站', max: 30 },
    ],
    search: ['name', 'site', 'note'],
  },
  {
    id: 'quota',
    aliases: ['額度'],
    group: 'daily',
    table: 'quota',
    name: '額度',
    title: '鋒兄額度',
    subtitle: '依服務展開帳號、剩餘額度與到期日。',
    order: 'name.asc,created_at.desc',
    fields: [
      text('name', '服務', { required: true, max: 100 }),
      choice('servicetype', '服務類型', SERVICE_TYPES, { default: 'general' }),
      text('account', '帳號', { max: 200 }),
      int('quotaremaining', '剩餘額度'),
      int('quotaratio', '額度比例%'),
      date('quotaexpiry', '額度到期'),
      int('ratio5h', '5 小時比例%'),
      text('expiry5h', '5 小時重置', { max: 10 }),
      int('ratioweek', '一週比例%'),
      text('expiryweek', '一週到期', { max: 10 }),
      int('ratiomonth', '一月比例%'),
      text('expirymonth', '一月到期', { max: 10 }),
      longtext('note', '備註', { max: 3337 }),
    ],
    columns: [
      { key: 'name', label: '服務', max: 22 },
      { key: 'servicetype', label: '類型', format: (r) => labelOf(SERVICE_TYPES, r.servicetype) },
      { key: 'account', label: '帳號', max: 28 },
      { key: 'quotaremaining', label: '剩餘', align: 'right', format: (r) => formatNumber(r.quotaremaining) },
      { key: 'quotaratio', label: '比例', align: 'right', format: (r) => (r.quotaratio ? `${r.quotaratio}%` : '') },
      {
        key: 'quotaexpiry',
        label: '到期',
        format: (r) => (r.quotaexpiry ? `${formatDate(r.quotaexpiry)} (${formatDays(daysUntil(r.quotaexpiry))})` : ''),
        color: dayColor((r) => daysUntil(r.quotaexpiry), 3, 7),
      },
      {
        key: 'ai',
        label: '5h / 週 / 月',
        format: (r) => (r.servicetype === 'ai' ? [r.ratio5h, r.ratioweek, r.ratiomonth].map((v) => (v ? `${v}%` : '-')).join(' / ') : ''),
      },
    ],
    search: ['name', 'account', 'note'],
  },
  {
    id: 'shopping',
    aliases: ['shoppinglist', 'shopping-list', 'shop', '購物', '購物清單'],
    group: 'daily',
    table: 'shoppinglist',
    name: '購物清單',
    title: '鋒兄購物清單',
    subtitle: '記錄想買的商品、預定購買日、價格與取貨方式。',
    order: 'planneddate.asc.nullslast',
    fields: [
      text('name', '商品', { required: true, max: 100 }),
      date('planneddate', '預定購買日'),
      int('price', '價格'),
      choice('currency', '幣別', CURRENCIES, { default: 'TWD' }),
      int('quantity', '數量', { default: 1 }),
      text('shop', '商店', { max: 100 }),
      text('pickupmethod', '取貨方式', { max: 30, suggestions: PICKUP_PRESETS }),
      text('imageurl', '商品圖片網址'),
      text('account', '帳號', { max: 200 }),
      longtext('note', '備註', { max: 3337 }),
    ],
    columns: [
      { key: 'name', label: '商品', max: 30 },
      { key: 'planneddate', label: '預定日', format: (r) => formatDate(r.planneddate) },
      { key: 'price', label: '價格', align: 'right', format: (r) => formatMoney(r.price, r.currency) },
      { key: 'quantity', label: '數量', align: 'right' },
      { key: 'shop', label: '商店', max: 14 },
      { key: 'pickupmethod', label: '取貨', max: 12 },
    ],
    search: ['name', 'shop', 'pickupmethod', 'account', 'note'],
    summary(rows) {
      const total = rows.reduce((s, r) => s + toTwd((Number(r.price) || 0) * (Number(r.quantity) || 1), r.currency), 0);
      return `預估總額 NT$ ${formatNumber(total)}`;
    },
  },
  {
    id: 'food',
    aliases: ['foods', '食品'],
    group: 'daily',
    table: 'food',
    name: '食品',
    title: '鋒兄食品',
    subtitle: '管理食品與庫存期限。',
    order: 'todate.asc.nullslast',
    fields: [
      text('name', '名稱', { required: true, max: 100 }),
      int('amount', '數量'),
      int('price', '價格'),
      text('shop', '商店', { max: 100 }),
      date('todate', '到期日'),
      text('photo', '照片'),
      text('photohash', '照片 Hash', { max: 256, hidden: true }),
    ],
    columns: [
      { key: 'name', label: '名稱', max: 30 },
      { key: 'amount', label: '數量', align: 'right' },
      { key: 'price', label: '價格', align: 'right', format: (r) => (r.price ? formatMoney(r.price) : '') },
      { key: 'shop', label: '商店', max: 14 },
      { key: 'todate', label: '到期日', format: (r) => formatDate(r.todate) },
      {
        key: 'days',
        label: '剩餘',
        format: (r) => formatDays(daysUntil(r.todate)),
        color: dayColor((r) => daysUntil(r.todate), 7, 30),
      },
    ],
    search: ['name', 'shop'],
  },
  {
    id: 'routine',
    aliases: ['routines', '例行'],
    group: 'daily',
    table: 'routine',
    name: '例行',
    title: '鋒兄例行',
    subtitle: '管理固定流程與最近執行日期。',
    order: 'lastdate1.desc.nullslast',
    fields: [
      text('name', '名稱', { required: true, max: 100 }),
      text('note', '備註', { max: 100 }),
      datetime('lastdate1', '最近一次'),
      datetime('lastdate2', '前一次'),
      datetime('lastdate3', '前兩次'),
      text('link', '連結'),
      text('photo', '照片'),
    ],
    columns: [
      { key: 'name', label: '名稱', max: 26 },
      { key: 'lastdate1', label: '最近一次', format: (r) => formatDate(r.lastdate1) },
      { key: 'ago', label: '距今', format: (r) => (r.lastdate1 ? `${Math.max(0, -daysUntil(r.lastdate1))} 天前` : '') },
      { key: 'lastdate2', label: '前一次', format: (r) => formatDate(r.lastdate2) },
      {
        key: 'interval',
        label: '間隔',
        format: (r) => {
          const d = daysBetween(r.lastdate2, r.lastdate1);
          return d === null ? '' : `相差 ${d} 天`;
        },
      },
      { key: 'note', label: '備註', max: 24 },
    ],
    search: ['name', 'note', 'link'],
  },
  {
    id: 'note',
    aliases: ['notes', 'article', 'articles', '筆記'],
    group: 'content',
    table: 'article',
    name: '筆記',
    title: '鋒兄筆記',
    subtitle: '整理筆記與附件。',
    titleField: 'title',
    order: 'newdate.desc.nullslast',
    fields: [
      text('title', '標題', { required: true, max: 100 }),
      longtext('content', '內容'),
      text('category', '分類', { max: 100 }),
      text('ref', '參考', { max: 100 }),
      date('newdate', '日期', { defaultToday: true }),
      text('url1', '網址1'),
      text('url2', '網址2'),
      text('url3', '網址3'),
      text('file1', '附件1', { max: 150, media: true }),
      text('file1name', '附件1名稱', { max: 100, hidden: true }),
      text('file1type', '附件1類型', { max: 20, hidden: true }),
      text('file2', '附件2', { max: 150, media: true }),
      text('file2name', '附件2名稱', { max: 100, hidden: true }),
      text('file2type', '附件2類型', { max: 20, hidden: true }),
      text('file3', '附件3', { max: 150, media: true }),
      text('file3name', '附件3名稱', { max: 100, hidden: true }),
      text('file3type', '附件3類型', { max: 20, hidden: true }),
    ],
    columns: [
      { key: 'newdate', label: '日期', format: (r) => formatDate(r.newdate) },
      { key: 'title', label: '標題', max: 36 },
      { key: 'category', label: '分類', max: 12 },
      { key: 'content', label: '內容', max: 40 },
      { key: 'att', label: '附件', format: (r) => [r.file1, r.file2, r.file3].filter(Boolean).length || '' },
    ],
    search: ['title', 'content', 'category', 'ref'],
  },
  {
    id: 'document',
    aliases: ['documents', 'doc', 'docs', 'commondocument', '文件'],
    group: 'content',
    table: 'commondocument',
    name: '文件',
    title: '鋒兄文件',
    subtitle: '管理結構化文件。',
    order: 'created_at.desc',
    fields: mediaFields({ filetype: false }),
    columns: [
      { key: 'name', label: '名稱', max: 40 },
      { key: 'category', label: '分類', max: 12 },
      { key: 'note', label: '備註', max: 24 },
      { key: 'created_at', label: '建立', format: (r) => formatDate(r.created_at) },
    ],
    search: ['name', 'category', 'note', 'ref'],
    media: { field: 'file', folder: 'documents', coverFolder: 'document-covers' },
  },
  {
    id: 'gallery',
    aliases: ['image', 'images', 'photo', '圖片', '圖庫'],
    group: 'content',
    table: 'image',
    name: '圖片',
    title: '鋒兄圖片',
    subtitle: '管理圖片素材。',
    order: 'created_at.desc',
    fields: mediaFields(),
    columns: mediaColumns(),
    search: ['name', 'category', 'note', 'ref'],
    media: { field: 'file', folder: 'gallery', coverFolder: 'gallery-covers' },
  },
  {
    id: 'video',
    aliases: ['videos', '影片'],
    group: 'content',
    table: 'video',
    name: '影片',
    title: '鋒兄影片',
    subtitle: '管理影片與封面。',
    order: 'created_at.desc',
    fields: mediaFields(),
    columns: mediaColumns(),
    search: ['name', 'category', 'note', 'ref'],
    media: { field: 'file', folder: 'video', coverFolder: 'video-covers' },
  },
  {
    id: 'music',
    aliases: ['song', 'songs', '音樂'],
    group: 'content',
    table: 'music',
    name: '音樂',
    title: '鋒兄音樂',
    subtitle: '管理歌曲、歌詞與封面。',
    order: 'created_at.desc',
    fields: mediaFields({ lyrics: true }),
    columns: mediaColumns([{ key: 'language', label: '語言', max: 8 }]),
    search: ['name', 'category', 'language', 'lyrics', 'note'],
    media: { field: 'file', folder: 'music', coverFolder: 'music-covers' },
  },
  {
    id: 'podcast',
    aliases: ['podcasts', '播客'],
    group: 'content',
    table: 'podcast',
    name: '播客',
    title: '鋒兄播客',
    subtitle: '管理播客音檔。',
    order: 'created_at.desc',
    fields: mediaFields({ noteMax: 20 }),
    columns: mediaColumns(),
    search: ['name', 'category', 'note'],
    media: { field: 'file', folder: 'podcast', coverFolder: 'podcast-covers' },
  },
  {
    id: 'bank',
    aliases: ['banks', 'bank-stats', '銀行', '票證', '點數'],
    group: 'finance',
    table: 'bank',
    name: '銀行/票證/點數',
    title: '鋒兄銀行',
    subtitle: '管理銀行、電子票證與點數紀錄。',
    order: 'deposit.desc',
    fields: [
      text('name', '名稱', { required: true, max: 100 }),
      int('deposit', '存款'),
      int('withdrawals', '提款'),
      int('transfer', '轉帳'),
      text('site', '網站'),
      text('address', '地址', { max: 100 }),
      longtext('activity', '活動'),
      text('card', '卡號', { max: 100, secret: true }),
      text('account', '帳號', { max: 100, secret: true }),
    ],
    columns: [
      { key: 'kind', label: '類別', format: bankKind, color: (r, t) => (isPointsItem(r) ? c.magenta(t) : isBankAccount(r) ? c.cyan(t) : c.blue(t)) },
      { key: 'name', label: '名稱', max: 22 },
      { key: 'deposit', label: '存款/餘額', align: 'right', format: (r) => formatNumber(r.deposit) },
      { key: 'withdrawals', label: '提款', align: 'right', format: (r) => (r.withdrawals ? formatNumber(r.withdrawals) : '') },
      { key: 'transfer', label: '轉帳', align: 'right', format: (r) => (r.transfer ? formatNumber(r.transfer) : '') },
      { key: 'activity', label: '活動', max: 30 },
    ],
    search: ['name', 'activity', 'address', 'site'],
    summary(rows) {
      const sum = (list) => list.reduce((s, r) => s + (Number(r.deposit) || 0), 0);
      const banks = rows.filter(isBankAccount);
      const points = rows.filter(isPointsItem);
      const tickets = rows.filter((r) => !isBankAccount(r) && !isPointsItem(r));
      return [
        `銀行 ${banks.length} 個：NT$ ${formatNumber(sum(banks))}`,
        `電子票證 ${tickets.length} 個：NT$ ${formatNumber(sum(tickets))}`,
        `點數 ${points.length} 項：${formatNumber(sum(points))} 點`,
      ].join('　');
    },
  },
  {
    id: 'common',
    aliases: ['commonaccount', 'account', 'accounts', '常用', '帳號'],
    group: 'finance',
    table: 'commonaccount',
    name: '常用帳號',
    title: '鋒兄常用',
    subtitle: '管理常用帳號與備註。',
    order: 'name.asc',
    fields: [text('name', '名稱', { required: true, max: 100 }), ...commonSiteFields, text('photohash', '照片 Hash', { max: 256, hidden: true })],
    columns: [
      { key: 'name', label: '名稱', max: 30 },
      { key: 'count', label: '網站數', align: 'right', format: (r) => commonPairs(r).length },
      { key: 'sites', label: '網站', max: 60, format: (r) => commonPairs(r).map((p) => p.site).filter(Boolean).join('、') },
    ],
    search: ['name', ...commonSiteFields.map((f) => f.key)],
    detail(row) {
      return commonPairs(row).map((p) => [`#${p.n}`, p.note ? `${p.site}  ${c.gray(p.note)}` : p.site]);
    },
  },
];

export function findModule(name) {
  if (!name) return null;
  const key = String(name).trim().toLowerCase();
  return MODULES.find((m) => m.id === key || m.table === key || m.aliases.includes(key)) || null;
}

export function titleOf(mod, row) {
  return row[mod.titleField || 'name'] || '（未命名）';
}

export function fieldOf(mod, key) {
  return mod.fields.find((f) => f.key === key.toLowerCase());
}

export function formatFieldValue(field, value, { reveal = false } = {}) {
  if (value === null || value === undefined || value === '') return '';
  if (field.secret && !reveal) return c.dim('•••••• (--reveal 顯示)');
  switch (field.type) {
    case 'enum':
      return `${labelOf(field.options, value)}${labelOf(field.options, value) !== value ? c.gray(` (${value})`) : ''}`;
    case 'bool':
      return value ? '是' : '否';
    case 'date':
      return `${formatDate(value)} ${c.gray(`(${formatDays(daysUntil(value))})`)}`;
    case 'datetime':
      return formatDate(value);
    case 'int':
      return formatNumber(value);
    default:
      return String(value);
  }
}

export { labelOf };
