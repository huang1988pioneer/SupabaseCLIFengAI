// 互動式選單：模擬網頁版側欄的導覽方式。
import { c, heading } from '../ui.js';
import { GROUPS, MODULES, findModule } from '../modules.js';
import { ask, choose, CancelledError } from '../prompt.js';
import { homeCommand, dashboardCommand } from './overview.js';
import { configCommand, aboutCommand } from './settings.js';
import { listCommand, runModuleAction, moduleHint, MODULE_ACTIONS } from './records.js';
import { routeInput, tokenize } from '../shell.js';
import { parseArgs } from '../args.js';

async function run(ctx, fn) {
  try {
    await fn();
  } catch (err) {
    if (err instanceof CancelledError) throw err;
    ctx.error(`✗ ${err.message}`);
  }
  ctx.print('');
}

const REFRESH_AFTER = new Set(['add', 'new', 'create', 'edit', 'update', 'set', 'delete', 'del', 'rm', 'remove', 'import']);

/** 模組畫面：先列表，之後用序號操作（和 Appwrite 版相同）。 */
async function moduleScreen(ctx, mod) {
  let search = '';
  const showList = () => run(ctx, () => listCommand(ctx, mod, search ? [search] : [], {}));
  await showList();
  for (;;) {
    ctx.print(moduleHint(mod));
    let tokens;
    try {
      tokens = tokenize(await ask(`${c.bold(mod.name)} ${c.cyan('›')}`));
    } catch (err) {
      if (err instanceof CancelledError && !err.eof) continue;
      if (err instanceof CancelledError) throw err;
      ctx.error(`✗ ${err.message}`);
      continue;
    }
    if (!tokens.length) continue;
    const routed = routeInput(mod, tokens);
    if (routed.leave) return;
    if (findModule(routed.argv[0]) !== mod) {
      ctx.print(c.yellow('看不懂這個指令；要切換模組請先輸入 q 返回。'));
      continue;
    }
    const { positional, flags } = parseArgs(routed.argv.slice(1));
    const action = String(positional[0] || 'list').toLowerCase();
    if (['list', 'ls', 'search', 'find'].includes(action)) {
      search = positional.slice(1).join(' ');
      await showList();
      continue;
    }
    await run(ctx, () => runModuleAction(ctx, mod, positional, flags));
    if (REFRESH_AFTER.has(action) || MODULE_ACTIONS[mod.id]?.[action]) await showList();
  }
}

export async function menuCommand(ctx) {
  for (;;) {
    ctx.print(heading('鋒兄 Console', `FENG_CONSOLE · ${ctx.source.name === '.env' ? 'supabase-.env' : `supabase-${ctx.source.name}`}`));
    const top = [
      { value: 'home', label: '首頁', hint: '查看今天最需要處理的事項' },
      { value: 'dashboard', label: '儀表', hint: '費用、到期項目與資料狀態' },
      ...GROUPS.map((g) => ({ value: `g:${g.id}`, label: g.name, hint: g.subtitle })),
      { value: 'settings', label: '設定', hint: '來源設定與資料表狀態' },
      { value: 'about', label: '關於' },
    ];
    const pick = await choose('前往：', top);
    if (!pick) return;
    if (pick.startsWith('g:')) {
      const group = pick.slice(2);
      for (;;) {
        const mods = MODULES.filter((m) => m.group === group);
        ctx.print(heading(GROUPS.find((g) => g.id === group).name));
        const modId = await choose('選擇模組：', mods.map((m) => ({ value: m.id, label: m.name, hint: m.subtitle })));
        if (!modId) break;
        await moduleScreen(ctx, MODULES.find((m) => m.id === modId));
      }
      continue;
    }
    await run(ctx, async () => {
      if (pick === 'home') return homeCommand(ctx, [], {});
      if (pick === 'dashboard') return dashboardCommand(ctx, [], {});
      if (pick === 'settings') {
        await configCommand(ctx, ['show'], {});
        ctx.print('');
        return configCommand(ctx, ['test'], {});
      }
      if (pick === 'about') return aboutCommand(ctx);
      return undefined;
    });
    ctx.print(c.gray('─'.repeat(40)));
  }
}
