# 鋒兄AI Supabase CLI

[鋒兄AI Supabase 網頁版](https://fengbroaisupabase.netlify.app) 的命令列版本。沿用同一個 Supabase 專案、同樣的資料表與欄位，在終端機裡管理訂閱、食品、額度、筆記、媒體與銀行資料。

- 零相依套件，只需要 Node.js 18 以上（使用內建 `fetch`）
- 首頁／儀表的到期規則與網頁版相同（訂閱 3／7 天、食品 7／30 天）
- 支援 CSV / JSON 匯入匯出、`--json` 輸出、`--dry-run` 預覽、互動式選單
- 可切換多組 Supabase 來源（對應網頁版「鋒兄設定」）

## 安裝

```bash
cd SupabaseCLIFengAI
npm link          # 之後就能直接輸入 fengbro3（簡寫 feng 也可以）
```

不想全域安裝的話，也可以直接執行 `node bin/fengbro3.js …`。

## 快速上手

```bash
fengbro3                      # 首頁：今天最需要處理的事項
fengbro3 dashboard            # 儀表：費用、到期提醒、各資料表筆數
fengbro3 menu                 # 互動式選單，像網頁側欄一樣逐層瀏覽
fengbro3 --help               # 全部指令
```

## 模組

| 分類 | 模組 | 資料表 | 別名 |
| --- | --- | --- | --- |
| 日常管理 | `subscription` 訂閱 | `subscription` | `sub` `訂閱` |
| | `trial-purchase` 試用/首購 | `trialpurchase` | `trial` `試用` |
| | `reinstall` 重灌 | `reinstall` | `重灌` |
| | `quota` 額度 | `quota` | `額度` |
| | `shopping` 購物清單 | `shoppinglist` | `shop` `購物` |
| | `food` 食品 | `food` | `食品` |
| | `routine` 例行 | `routine` | `例行` |
| 內容中心 | `note` 筆記 | `article` | `notes` `筆記` |
| | `document` 文件 | `commondocument` | `doc` `文件` |
| | `gallery` 圖片 | `image` | `image` `圖片` |
| | `video` 影片 | `video` | `影片` |
| | `music` 音樂 | `music` | `song` `音樂` |
| | `podcast` 播客 | `podcast` | `播客` |
| 財務與帳號 | `bank` 銀行/票證/點數 | `bank` | `銀行` |
| | `common` 常用帳號 | `commonaccount` | `account` `常用` |

## 模組動作

```bash
fengbro3 <模組> [list] [關鍵字]           # 列表（預設動作）
fengbro3 <模組> show <id|名稱>            # 詳細資料
fengbro3 <模組> add [名稱] --欄位 值 …     # 新增；不帶欄位時逐欄詢問
fengbro3 <模組> edit <id|名稱> --欄位 值   # 編輯；不帶欄位時逐欄詢問
fengbro3 <模組> delete <id|名稱> …        # 刪除（可多筆，-y 略過確認）
fengbro3 <模組> due [天數]                # 即將到期（訂閱/食品/額度/試用/購物）
fengbro3 <模組> export [檔案.csv|.json]   # 匯出；不給檔名就輸出到 stdout
fengbro3 <模組> import <檔案>             # 匯入；同名資料會更新，未變更的略過
fengbro3 <模組> fields                    # 欄位、型別與可用選項
fengbro3 <模組> url <id|名稱> [--open]    # 媒體檔案的連結（私有 bucket 會產生簽名網址）
```

`<id|名稱>` 可以是完整 id、列表上顯示的 8 碼 id 前綴，或名稱／名稱片段；有多筆符合時會列出候選項。

模組專屬動作：

```bash
fengbro3 sub toggle Netflix               # 切換續訂 / 停止續訂
fengbro3 sub renew Netflix --months 1     # 下次扣款日往後推一個月
fengbro3 routine done 鋒兄理髮              # 記錄今天完成（最近一次 → 前一次 → 前兩次）
fengbro3 food use 牛奶 1                   # 消耗庫存數量
```

### 常用旗標

| 旗標 | 說明 |
| --- | --- |
| `-s, --search <字>` | 搜尋（多個關鍵字需全部符合） |
| `-n, --limit <數>` | 只顯示前 N 筆 |
| `--sort <欄位> [--desc]` | 排序 |
| `--full` | 不截斷欄位內容 |
| `--json` | 輸出 JSON，方便搭配 `jq` |
| `--dry-run` | 預覽要寫入的內容，不實際寫入 |
| `--reveal` | 顯示序號、卡號等機密欄位（預設遮蔽） |
| `--all` | 詳細頁也顯示空白與進階欄位 |
| `--overdue` | `due` 包含已過期項目 |
| `--upload <檔案>` | 媒體模組新增時上傳檔案到 Storage |
| `-p, --profile <名稱>` | 本次使用指定來源 |
| `--no-color` | 停用顏色（也支援 `NO_COLOR`） |

日期欄位可輸入 `YYYY-MM-DD`、`today`、`tomorrow`、`+7`、`-3`、`+2w`、`+1m`、`+1y`；輸入空字串 `""` 可清空欄位。

## 範例

```bash
fengbro3 sub due 7
fengbro3 sub add Netflix --price 390 --nextdate 2026-10-15 --account me@example.com
fengbro3 sub add ChatGPT --price 20 --currency USD --nextdate +1m
fengbro3 food add 牛奶 --amount 2 --todate +7 --shop 全聯
fengbro3 trial add Cursor --account me@example.com --trialstatus tried
fengbro3 note -s supabase -n 5
fengbro3 gallery add --upload ./cover.png --category 封面
fengbro3 music export music.csv
fengbro3 food import food.csv --dry-run
fengbro3 quota --json | jq '.[] | select(.servicetype=="ai") | .name'
```

## 設定（Supabase 來源）

預設使用網頁版的公開設定（`supabase-.env`）。要連到自己的 Supabase 專案：

```bash
fengbro3 config add mine --url https://xxxx.supabase.co --key <anon key> --bucket <bucket>
fengbro3 config use mine        # 切換；fengbro3 config use .env 切回預設
fengbro3 config test            # 檢查所有資料表是否存在與筆數
fengbro3 sql food               # 輸出建表 SQL（fengbro3 sql all 輸出全部）
```

設定檔位於 `~/.config/fengbro-supabase/config.json`（權限 600）。也可以用環境變數覆蓋：

| 環境變數 | 說明 |
| --- | --- |
| `SUPABASE_URL` / `FENG_SUPABASE_URL` | Supabase 網址 |
| `SUPABASE_ANON_KEY` / `FENG_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_BUCKET` / `FENG_SUPABASE_BUCKET` | Storage bucket |
| `FENG_PROFILE` | 使用哪個來源 |
| `FENG_CONFIG` | 設定檔路徑 |
| `FENG_DEBUG` | 出錯時印出完整堆疊 |

## 與網頁版的差異

- 網頁版「工具」分類（比價、手機比價、鋒兄 Tube、金融、新聞、圖片語音成片、格式轉換、影片合併、YT/B 站轉檔）依賴瀏覽器與 Netlify 伺服器 API，CLI 版未包含。
- 網頁版的回收桶、推播通知、Resend 郵件設定、ZIP 媒體打包未包含；CSV / JSON 匯入匯出則可用。
- 刪除在 CLI 中是直接刪除（會先確認），沒有網頁版的回收桶可還原。

## 開發

```bash
npm test                  # node:test 單元測試
```

```
bin/fengbro3.js           進入點
src/cli.js                指令分派與說明
src/modules.js            15 個模組的欄位、列表欄與別名
src/commands/records.js   通用 CRUD、匯入匯出、到期、模組專屬動作
src/commands/overview.js  首頁與儀表
src/commands/settings.js  設定、資料表狀態、SQL、關於
src/commands/menu.js      互動式選單
src/supabase.js           PostgREST / Storage 客戶端
src/schema.js             建表 SQL（取自網頁版）
```
