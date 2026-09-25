// 互動式選單：模擬網頁版側欄的導覽方式。
import { c, heading } from '../ui.js';
import { GROUPS, MODULES } from '../modules.js';
import { ask, choose, CancelledError } from '../prompt.js';
import { homeCommand, dashboardCommand } from './overview.js';
import { configCommand, aboutCommand } from './settings.js';
import {
  listCommand,
  showCommand,
  addCommand,
  editCommand,
  deleteCommand,
  exportCommand,
  dueCommand,
  urlCommand,
  DUE,
  MODULE_ACTIONS,
} from './records.js';

async function run(ctx, fn) {
  try {
    await fn();
  } catch (err) {
    if (err instanceof CancelledError) throw err;
    ctx.error(`✗ ${err.message}`);
  }
  ctx.print('');
}

async function moduleMenu(ctx, mod) {
  for (;;) {
    ctx.print(heading(mod.title, mod.subtitle));
    const options = [
      { value: 'list', label: '列表' },
      { value: 'search', label: '搜尋' },
      { value: 'show', label: '查看詳細' },
      { value: 'add', label: '新增' },
      { value: 'edit', label: '編輯' },
      { value: 'delete', label: '刪除' },
    ];
    if (DUE[mod.id]) options.push({ value: 'due', label: '即將到期', hint: `${DUE[mod.id].days} 天內` });
    if (mod.fields.some((f) => f.media)) options.push({ value: 'url', label: '取得檔案連結' });
    for (const [name, action] of Object.entries(MODULE_ACTIONS[mod.id] || {})) options.push({ value: `x:${name}`, label: action.desc, hint: name });
    options.push({ value: 'export', label: '匯出 CSV' });

    const pick = await choose('選擇操作：', options);
    if (!pick) return;
    const needRef = ['show', 'edit', 'delete', 'url'].includes(pick) || pick.startsWith('x:');
    const ref = needRef ? await ask(`輸入 id 前綴或${mod.titleField === 'title' ? '標題' : '名稱'}：`) : '';
    if (needRef && !ref) continue;

    await run(ctx, async () => {
      switch (pick) {
        case 'list':
          return listCommand(ctx, mod, [], {});
        case 'search': {
          const q = await ask('搜尋關鍵字：');
          return listCommand(ctx, mod, [], { search: q });
        }
        case 'show':
          return showCommand(ctx, mod, [ref], {});
        case 'add':
          return addCommand(ctx, mod, [], { interactive: true });
        case 'edit':
          return editCommand(ctx, mod, [ref], { interactive: true });
        case 'delete':
          return deleteCommand(ctx, mod, [ref], {});
        case 'due':
          return dueCommand(ctx, mod, [], { overdue: true });
        case 'url':
          return urlCommand(ctx, mod, [ref], {});
        case 'export': {
          const file = await ask('輸出檔名：', { defaultValue: `supabase-${mod.table}.csv` });
          return exportCommand(ctx, mod, [file], {});
        }
        default: {
          const action = MODULE_ACTIONS[mod.id][pick.slice(2)];
          return action.run(ctx, mod, [ref], {});
        }
      }
    });
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
        await moduleMenu(ctx, MODULES.find((m) => m.id === modId));
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
