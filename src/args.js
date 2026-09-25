// 命令列參數解析：支援 --key value、--key=value、--no-key、短旗標與動態欄位旗標。

const BOOLEAN_FLAGS = new Set([
  'json',
  'yes',
  'help',
  'reveal',
  'all',
  'dry-run',
  'color',
  'desc',
  'asc',
  'version',
  'interactive',
  'open',
  'public',
  'ids',
  'full',
]);

const SHORT = { s: 'search', n: 'limit', y: 'yes', j: 'json', h: 'help', p: 'profile', o: 'output', v: 'version', i: 'interactive', f: 'format' };

const looksLikeValue = (token) => token !== undefined && (!token.startsWith('-') || /^-\d/.test(token));

export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  const set = (key, value) => {
    if (key in flags && flags[key] !== value && !BOOLEAN_FLAGS.has(key)) {
      flags[key] = [].concat(flags[key], value);
    } else {
      flags[key] = value;
    }
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (token.startsWith('--')) {
      const body = token.slice(2);
      const eq = body.indexOf('=');
      if (eq >= 0) {
        set(body.slice(0, eq), body.slice(eq + 1));
        continue;
      }
      if (BOOLEAN_FLAGS.has(body)) {
        flags[body] = true;
        continue;
      }
      if (body.startsWith('no-')) {
        flags[body.slice(3)] = false;
        continue;
      }
      if (looksLikeValue(argv[i + 1])) {
        set(body, argv[i + 1]);
        i += 1;
      } else {
        set(body, true);
      }
      continue;
    }
    if (/^-[a-zA-Z]+$/.test(token)) {
      const letters = token.slice(1).split('');
      letters.forEach((letter, idx) => {
        const key = SHORT[letter] || letter;
        const last = idx === letters.length - 1;
        if (!BOOLEAN_FLAGS.has(key) && last && looksLikeValue(argv[i + 1])) {
          set(key, argv[i + 1]);
          i += 1;
        } else {
          flags[key] = true;
        }
      });
      continue;
    }
    positional.push(token);
  }
  return { positional, flags };
}

/** 取得單一字串值（重複旗標取最後一個）。 */
export function flagValue(flags, key) {
  const v = flags[key];
  return Array.isArray(v) ? v[v.length - 1] : v;
}
