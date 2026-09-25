// 主程式：解析參數並分派到各指令。
import { parseArgs, flagValue } from './args.js';
import { c, setColor, isColor, heading, pad, strWidth } from './ui.js';
import { resolveSource } from './config.js';
import { SupabaseClient, friendlyError } from './supabase.js';
import { GROUPS, MODULES, findModule } from './modules.js';
import { closePrompt, CancelledError } from './prompt.js';
import { homeCommand, dashboardCommand } from './commands/overview.js';
import { configCommand, sqlCommand, aboutCommand, VERSION } from './commands/settings.js';
import { menuCommand } from './commands/menu.js';
import { runShell, shellHelp } from './shell.js';
import {
  listCommand,
  showCommand,
  addCommand,
  editCommand,
  deleteCommand,
  exportCommand,
  importCommand,
  fieldsCommand,
  urlCommand,
  dueCommand,
  DUE,
  MODULE_ACTIONS,
} from './commands/records.js';

const defaultColor = isColor();

const RECORD_ACTIONS = {
  list: listCommand,
  ls: listCommand,
  search: listCommand,
  find: listCommand,
  show: showCommand,
  get: showCommand,
  view: showCommand,
  add: addCommand,
  new: addCommand,
  create: addCommand,
  edit: editCommand,
  update: editCommand,
  set: editCommand,
  delete: deleteCommand,
  del: deleteCommand,
  rm: deleteCommand,
  remove: deleteCommand,
  export: exportCommand,
  import: importCommand,
  fields: fieldsCommand,
  url: urlCommand,
  open: urlCommand,
  due: dueCommand,
  expiring: dueCommand,
};

function mainHelp() {
  const cmd = (name, desc) => `  ${c.green(pad(name, 26))}${c.gray(desc)}`;
  const lines = [
    heading(`鋒兄AI Supabase CLI v${VERSION}`, '網頁版 fengbroaisupabase.netlify.app 的命令列版本'),
    '',
    c.bold('用法'),
    '  fengbro3 <指令> [參數] [--旗標]',
    '  fengbro3 <模組> <動作> [參數] [--欄位 值 …]',
    '',
    c.bold('總覽'),
    cmd('fengbro3', '進入互動 shell（持續執行，輸入 exit 離開）'),
    cmd('fengbro3 home', '首頁：今天最需要處理的事項'),
    cmd('fengbro3 dashboard', '儀表：費用、到期提醒與資料狀態'),
    cmd('fengbro3 menu', '互動式選單（像網頁側欄一樣逐層瀏覽）'),
    cmd('fengbro3 modules', '列出所有模組與別名'),
    '',
  ];
  for (const g of GROUPS) {
    lines.push(c.bold(g.name));
    for (const m of MODULES.filter((x) => x.group === g.id)) {
      lines.push(cmd(`fengbro3 ${m.id}`, `${m.name} — ${m.subtitle}`));
    }
    lines.push('');
  }
  lines.push(
    c.bold('模組動作'),
    cmd('list [關鍵字]', '列表（預設動作）  -s 搜尋  -n 筆數  --sort 欄位 --desc  --full  --json'),
    cmd('show <id|名稱>', '查看詳細  --reveal 顯示序號/卡號  --all 顯示空欄位'),
    cmd('add [名稱] --欄位 值', '新增（不帶欄位時逐欄詢問）  --dry-run 預覽'),
    cmd('edit <id|名稱> --欄位 值', '編輯（不帶欄位時逐欄詢問）'),
    cmd('delete <id|名稱>…', '刪除，可多筆  -y 略過確認'),
    cmd('due [天數]', '即將到期（訂閱/食品/額度/試用/購物）  --overdue 含已過期'),
    cmd('export [檔案]', '匯出 CSV / JSON（依副檔名或 --format）'),
    cmd('import <檔案>', '匯入 CSV / JSON（同名則更新）  --dry-run  -y'),
    cmd('fields', '列出可用欄位、型別與選項'),
    cmd('url <id|名稱>', '媒體檔案連結  --open 用瀏覽器開啟'),
    '',
    c.bold('模組專屬'),
  );
  for (const [modId, actions] of Object.entries(MODULE_ACTIONS)) {
    for (const action of Object.values(actions)) lines.push(cmd(`fengbro3 ${modId} ${action.usage.split(' ')[0]}`, `${action.desc}  (${action.usage})`));
  }
  lines.push(
    '',
    c.bold('設定'),
    cmd('fengbro3 config', '顯示目前 Supabase 來源'),
    cmd('fengbro3 config add <名稱> …', '新增來源  --url --key [--bucket]'),
    cmd('fengbro3 config use <名稱>', '切換來源（.env 為預設）'),
    cmd('fengbro3 config test', '檢查所有資料表狀態'),
    cmd('fengbro3 sql [資料表|all]', '輸出建表 SQL'),
    cmd('fengbro3 about', '鋒兄關於'),
    '',
    c.bold('全域旗標'),
    cmd('-p, --profile <名稱>', '本次使用指定來源'),
    cmd('--json', '輸出 JSON（方便搭配 jq）'),
    cmd('--no-color', '停用顏色（也支援 NO_COLOR）'),
    cmd('-h, --help', '說明；fengbro3 <模組> --help 查看模組說明'),
    '',
    c.bold('範例'),
    '  fengbro3 sub due 7',
    '  fengbro3 sub add Netflix --price 390 --nextdate 2026-10-15 --account me@example.com',
    '  fengbro3 sub renew Netflix',
    '  fengbro3 food add 牛奶 --amount 2 --todate +7 --shop 全聯',
    '  fengbro3 note -s supabase -n 5',
    '  fengbro3 music export music.csv',
    '  fengbro3 trial --json | jq ".[].name"',
  );
  return lines.join('\n');
}

function moduleHelp(mod) {
  const lines = [heading(mod.title, `${mod.subtitle}  資料表 public.${mod.table}`), ''];
  lines.push(`別名：${[mod.id, ...mod.aliases].join(', ')}`, '');
  lines.push(c.bold('動作'));
  const acts = [
    ['list [關鍵字]', '列表（預設）'],
    ['show <id|名稱>', '查看詳細'],
    ['add [名稱] --欄位 值', '新增'],
    ['edit <id|名稱> --欄位 值', '編輯'],
    ['delete <id|名稱>…', '刪除'],
    ['export [檔案]', '匯出'],
    ['import <檔案>', '匯入'],
    ['fields', '欄位說明'],
  ];
  if (DUE[mod.id]) acts.push([`due [${DUE[mod.id].days}]`, '即將到期']);
  if (mod.fields.some((f) => f.media)) acts.push(['url <id|名稱>', '檔案連結；add 時可用 --upload <檔案> / --upload-cover <檔案>']);
  for (const a of Object.values(MODULE_ACTIONS[mod.id] || {})) acts.push([a.usage, a.desc]);
  const w = Math.max(...acts.map(([a]) => strWidth(a)));
  acts.forEach(([a, d]) => lines.push(`  ${c.green(pad(a, w))}  ${c.gray(d)}`));
  lines.push('', c.bold('欄位'));
  lines.push(
    `  ${mod.fields
      .filter((f) => !f.hidden)
      .map((f) => `--${f.key}${f.required ? c.red('*') : ''}`)
      .join('  ')}`,
  );
  lines.push(c.gray(`\n完整欄位說明：fengbro3 ${mod.id} fields`));
  return lines.join('\n');
}

function modulesList(ctx) {
  for (const g of GROUPS) {
    ctx.print(c.bold(g.name));
    for (const m of MODULES.filter((x) => x.group === g.id)) {
      ctx.print(`  ${c.green(pad(m.id, 16))}${pad(m.name, 16)}${c.gray(`${m.table}  ${m.aliases.join(', ')}`)}`);
    }
    ctx.print('');
  }
}

/** 執行一個指令並回傳結束代碼；互動 shell 會重複呼叫它。 */
export async function execute(argv, { inShell = false } = {}) {
  const { positional, flags } = parseArgs(argv);
  setColor(flags.color === undefined ? defaultColor : flags.color !== false);

  const out = (text) => process.stdout.write(`${text}\n`);
  const ctx = {
    print: out,
    printJson: (data) => out(JSON.stringify(data, null, 2)),
    error: (text) => process.stderr.write(`${c.red(text)}\n`),
  };

  const [command, ...rest] = positional;

  if (flags.version || command === 'version') {
    out(VERSION);
    return 0;
  }
  if (command === 'help' || (flags.help && !command)) {
    const mod = findModule(rest[0]);
    out(mod ? moduleHelp(mod) : mainHelp());
    if (inShell && !mod) out(shellHelp());
    return 0;
  }

  try {
    ctx.source = resolveSource(flagValue(flags, 'profile'));
    ctx.client = new SupabaseClient(ctx.source);
    const mod = findModule(command);

    if (mod) {
      if (flags.help) {
        out(moduleHelp(mod));
        return 0;
      }
      const [actionName, ...args] = rest;
      let action = actionName ? RECORD_ACTIONS[actionName.toLowerCase()] : listCommand;
      const special = actionName ? MODULE_ACTIONS[mod.id]?.[actionName.toLowerCase()] : null;
      if (special) {
        await special.run(ctx, mod, args, flags);
        return 0;
      }
      if (!action) {
        // `fengbro3 sub netflix` 視為搜尋。
        action = listCommand;
        args.unshift(actionName);
      }
      await action(ctx, mod, args, flags);
      return 0;
    }

    switch (command) {
      case undefined:
      case 'home':
        await homeCommand(ctx, rest, flags);
        return 0;
      case 'dashboard':
      case 'dash':
      case 'overview':
        await dashboardCommand(ctx, rest, flags);
        return 0;
      case 'menu':
      case 'ui':
        await menuCommand(ctx);
        return 0;
      case 'modules':
        modulesList(ctx);
        return 0;
      case 'config':
      case 'settings':
        await configCommand(ctx, rest, flags);
        return 0;
      case 'sql':
        sqlCommand(ctx, rest);
        return 0;
      case 'about':
        aboutCommand(ctx);
        return 0;
      default:
        ctx.error(`未知的指令或模組：${command}`);
        ctx.print(c.gray('執行 fengbro3 --help 查看所有指令，或 fengbro3 modules 查看模組列表。'));
        return 2;
    }
  } catch (err) {
    if (err instanceof CancelledError) {
      ctx.print(c.gray('\n已取消。'));
      return 130;
    }
    const mod = findModule(command);
    ctx.error(`✗ ${friendlyError(err, mod?.table || command)}`);
    if (process.env.FENG_DEBUG) console.error(err);
    return 1;
  }
}

export async function main(argv) {
  const [first] = parseArgs(argv).positional;
  const interactiveTerminal = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  // 不帶指令且在終端機中執行，或明確輸入 shell：進入持續執行的互動模式。
  const wantsShell = first === 'shell' || (argv.length === 0 && interactiveTerminal);
  try {
    if (wantsShell) return await runShell(execute, argv.filter((a) => a !== 'shell'));
    return await execute(argv);
  } finally {
    closePrompt();
  }
}
