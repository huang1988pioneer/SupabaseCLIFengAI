// 由網頁版「鋒兄設定 → 資料表狀態」擷取的建表 SQL（id 一律使用 UUID）。

export const TABLE_SQL = [
  {
    name: "article",
    label: "文章管理",
    sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.article (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(100) NOT NULL,
  content TEXT,
  category VARCHAR(100),
  ref VARCHAR(100),
  newdate TIMESTAMPTZ,
  url1 TEXT,
  url2 TEXT,
  url3 TEXT,
  file1 VARCHAR(150),
  file1name VARCHAR(100),
  file1type VARCHAR(20),
  file2 VARCHAR(150),
  file2name VARCHAR(100),
  file2type VARCHAR(20),
  file3 VARCHAR(150),
  file3name VARCHAR(100),
  file3type VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`,
  },
  {
    name: "bank",
    label: "銀行帳戶",
    sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  deposit INTEGER DEFAULT 0,
  site TEXT,
  address VARCHAR(100),
  withdrawals INTEGER DEFAULT 0,
  transfer INTEGER DEFAULT 0,
  activity TEXT,
  card VARCHAR(100),
  account VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`,
  },
  {
    name: "commonaccount",
    label: "常用帳號",
    sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.commonaccount (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  site01 VARCHAR(100), site02 VARCHAR(100), site03 VARCHAR(100), site04 VARCHAR(100), site05 VARCHAR(100),
  site06 VARCHAR(100), site07 VARCHAR(100), site08 VARCHAR(100), site09 VARCHAR(100), site10 VARCHAR(100),
  site11 VARCHAR(100), site12 VARCHAR(100), site13 VARCHAR(100), site14 VARCHAR(100), site15 VARCHAR(100),
  site16 VARCHAR(100), site17 VARCHAR(100), site18 VARCHAR(100), site19 VARCHAR(100), site20 VARCHAR(100),
  site21 VARCHAR(100), site22 VARCHAR(100), site23 VARCHAR(100), site24 VARCHAR(100), site25 VARCHAR(100),
  site26 VARCHAR(100), site27 VARCHAR(100), site28 VARCHAR(100), site29 VARCHAR(100), site30 VARCHAR(100),
  site31 VARCHAR(100), site32 VARCHAR(100), site33 VARCHAR(100), site34 VARCHAR(100), site35 VARCHAR(100),
  site36 VARCHAR(100), site37 VARCHAR(100),
  note01 VARCHAR(100), note02 VARCHAR(100), note03 VARCHAR(100), note04 VARCHAR(100), note05 VARCHAR(100),
  note06 VARCHAR(100), note07 VARCHAR(100), note08 VARCHAR(100), note09 VARCHAR(100), note10 VARCHAR(100),
  note11 VARCHAR(100), note12 VARCHAR(100), note13 VARCHAR(100), note14 VARCHAR(100), note15 VARCHAR(100),
  note16 VARCHAR(100), note17 VARCHAR(100), note18 VARCHAR(100), note19 VARCHAR(100), note20 VARCHAR(100),
  note21 VARCHAR(100), note22 VARCHAR(100), note23 VARCHAR(100), note24 VARCHAR(100), note25 VARCHAR(100),
  note26 VARCHAR(100), note27 VARCHAR(100), note28 VARCHAR(100), note29 VARCHAR(100), note30 VARCHAR(100),
  note31 VARCHAR(100), note32 VARCHAR(100), note33 VARCHAR(100), note34 VARCHAR(100), note35 VARCHAR(100),
  note36 VARCHAR(100), note37 VARCHAR(100),
  photohash VARCHAR(256),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`,
  },
  {
    name: "commondocument",
    label: "通用文件",
    sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.commondocument (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  file VARCHAR(150),
  note VARCHAR(100),
  ref VARCHAR(100),
  category VARCHAR(100),
  hash VARCHAR(300),
  cover VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`,
  },
  {
    name: "food",
    label: "食物庫存",
    sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.food (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  amount INTEGER DEFAULT 0,
  price INTEGER DEFAULT 0,
  shop VARCHAR(100),
  todate DATE,
  photo TEXT,
  photohash VARCHAR(256),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`,
  },
  {
    name: "image",
    label: "圖片管理",
    sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.image (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  file VARCHAR(150),
  filetype VARCHAR(20),
  note VARCHAR(100),
  ref VARCHAR(100),
  category VARCHAR(100),
  hash VARCHAR(300),
  cover VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`,
  },
  {
    name: "music",
    label: "音樂管理",
    sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.music (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  file VARCHAR(150),
  filetype VARCHAR(20),
  lyrics TEXT,
  note VARCHAR(100),
  ref VARCHAR(100),
  category VARCHAR(100),
  hash VARCHAR(300),
  language VARCHAR(100),
  cover VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`,
  },
  {
    name: "podcast",
    label: "播客管理",
    sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.podcast (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  file VARCHAR(150),
  filetype VARCHAR(20),
  note VARCHAR(20),
  ref VARCHAR(100),
  category VARCHAR(100),
  hash VARCHAR(300),
  cover VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`,
  },
  {
    name: "routine",
    label: "例行事項",
    sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.routine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  note VARCHAR(100),
  lastdate1 TIMESTAMPTZ,
  lastdate2 TIMESTAMPTZ,
  lastdate3 TIMESTAMPTZ,
  link TEXT,
  photo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`,
  },
  {
    name: "subscription",
    label: "訂閱管理",
    sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.subscription (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  site TEXT,
  account TEXT,
  price INTEGER,
  nextdate DATE,
  note TEXT,
  iscontinue BOOLEAN DEFAULT true,
  currency TEXT DEFAULT 'TWD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`,
  },
  {
    name: "trialpurchase",
    label: "試用／首購",
    sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.trialpurchase (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  eventdate DATE,
  firstpurchaseprice INTEGER DEFAULT 0,
  regularprice INTEGER DEFAULT 0,
  account VARCHAR(200),
  note VARCHAR(3337),
  trialstatus VARCHAR(20) DEFAULT 'untried',
  purchasestatus VARCHAR(30) DEFAULT 'not_purchased',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`,
  },
  {
    name: "quota",
    label: "鋒兄額度",
    sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.quota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  servicetype VARCHAR(20) DEFAULT 'general',
  account VARCHAR(200),
  quotaremaining INTEGER DEFAULT 0,
  quotaratio INTEGER DEFAULT 0,
  quotaexpiry DATE,
  ratio5h INTEGER DEFAULT 0,
  expiry5h VARCHAR(10),
  ratioweek INTEGER DEFAULT 0,
  expiryweek VARCHAR(10),
  ratiomonth INTEGER DEFAULT 0,
  expirymonth VARCHAR(10),
  note VARCHAR(3337),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`,
  },
  {
    name: "reinstall",
    label: "重灌軟體",
    sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.reinstall (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  system VARCHAR(10) DEFAULT 'win',
  softwaretype VARCHAR(20) DEFAULT 'free',
  licensetype VARCHAR(20) DEFAULT 'none',
  serial VARCHAR(500),
  viewpassword VARCHAR(100),
  subscriptionsoftware BOOLEAN DEFAULT false,
  subscriptionperiod VARCHAR(20),
  subscriptionprice INTEGER DEFAULT 0,
  subscriptioncurrency VARCHAR(10) DEFAULT 'TWD',
  site TEXT,
  note VARCHAR(3337),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reinstall
  ADD COLUMN IF NOT EXISTS subscriptionsoftware BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscriptionperiod VARCHAR(20),
  ADD COLUMN IF NOT EXISTS subscriptionprice INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscriptioncurrency VARCHAR(10) DEFAULT 'TWD';`,
  },
  {
    name: "video",
    label: "影片管理",
    sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.video (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT UNIQUE,
  file TEXT,
  filetype VARCHAR(20),
  note TEXT,
  ref TEXT,
  category TEXT,
  hash TEXT,
  cover TEXT
);`,
  },
  {
    name: "sitevisit",
    label: "進站人次",
    sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.sitevisit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rowkey VARCHAR(50) UNIQUE NOT NULL,
  count INTEGER DEFAULT 0,
  lastvisitat TIMESTAMPTZ,
  currentstreak INTEGER DEFAULT 0,
  lastvisitdate VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.sitevisit (rowkey, count)
SELECT 'site-visit', 0
WHERE NOT EXISTS (SELECT 1 FROM public.sitevisit WHERE rowkey = 'site-visit');`,
  },
  {
    name: "menuusage",
    label: "選單使用",
    sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.menuusage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moduleid VARCHAR(50) UNIQUE NOT NULL,
  count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`,
  },
  {
    name: "shoppinglist",
    label: "購物清單",
    sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.shoppinglist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  planneddate DATE,
  price INTEGER DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'TWD',
  quantity INTEGER DEFAULT 1,
  shop VARCHAR(100),
  pickupmethod VARCHAR(30),
  imageurl TEXT,
  account VARCHAR(200),
  note VARCHAR(3337),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.shoppinglist
  ADD COLUMN IF NOT EXISTS imageurl TEXT,
  ALTER COLUMN pickupmethod TYPE VARCHAR(30) USING LEFT(pickupmethod, 30);`,
  },
  {
    name: "toollistsync",
    label: "工具雲端清單",
    sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.toollistsync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_key VARCHAR(80) UNIQUE NOT NULL,
  payload JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`,
  },
  {
    name: "landtop_history",
    label: "手機比價歷史",
    sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.landtop_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_key VARCHAR(200) NOT NULL,
  keyword VARCHAR(200) NOT NULL,
  brand_label VARCHAR(50),
  product_name VARCHAR(200),
  snapshot_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  series JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_landtop_history_keyword_key ON public.landtop_history(keyword_key);`,
  },
];
