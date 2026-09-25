// 設定檔管理：對應網頁版「鋒兄設定」的多組 Supabase 來源。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 與網頁版 runtimeConfig.public 相同的預設來源（anon key 本來就公開在網頁中）。
export const DEFAULT_SOURCE = Object.freeze({
  name: '.env',
  supabaseUrl: 'https://jplhiwonjndkzreklfyw.supabase.co',
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwbGhpd29uam5ka3pyZWtsZnl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDY5NTMsImV4cCI6MjA5NTAyMjk1M30.xjd34DiQSrCiUOBgTYuE3_d_ABiO4rwIJq3Wr_n9TVM',
  bucket: 'goldshoot0720',
});

export function configPath() {
  if (process.env.FENG_CONFIG) return process.env.FENG_CONFIG;
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'fengbro', 'config.json');
}

export function loadConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    return {
      active: typeof raw.active === 'string' ? raw.active : null,
      profiles: raw.profiles && typeof raw.profiles === 'object' ? raw.profiles : {},
    };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      process.stderr.write(`⚠️  設定檔讀取失敗（${configPath()}）：${err.message}\n`);
    }
    return { active: null, profiles: {} };
  }
}

export function saveConfig(config) {
  const file = configPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

/**
 * 決定目前使用的來源。優先順序：
 * 環境變數 > --profile 參數 > FENG_PROFILE > 設定檔 active > 預設 .env
 */
export function resolveSource(profileName) {
  const config = loadConfig();
  const wanted = profileName || process.env.FENG_PROFILE || config.active;
  let source = { ...DEFAULT_SOURCE };
  let origin = 'default';

  if (wanted && wanted !== '.env') {
    const profile = config.profiles[wanted];
    if (!profile) {
      throw new Error(`找不到設定來源「${wanted}」。可用：${['.env', ...Object.keys(config.profiles)].join(', ')}`);
    }
    source = {
      name: wanted,
      supabaseUrl: profile.supabaseUrl || DEFAULT_SOURCE.supabaseUrl,
      supabaseAnonKey: profile.supabaseAnonKey || DEFAULT_SOURCE.supabaseAnonKey,
      bucket: profile.bucket || DEFAULT_SOURCE.bucket,
    };
    origin = 'profile';
  }

  const envUrl = process.env.FENG_SUPABASE_URL || process.env.SUPABASE_URL;
  const envKey = process.env.FENG_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const envBucket = process.env.FENG_SUPABASE_BUCKET || process.env.SUPABASE_BUCKET;
  if (envUrl || envKey || envBucket) {
    source = {
      name: 'env',
      supabaseUrl: envUrl || source.supabaseUrl,
      supabaseAnonKey: envKey || source.supabaseAnonKey,
      bucket: envBucket || source.bucket,
    };
    origin = 'environment';
  }

  source.supabaseUrl = source.supabaseUrl.replace(/\/+$/, '');
  return { ...source, origin };
}

export function displayName(source) {
  return source.name === '.env' ? 'supabase-.env' : `supabase-${source.name}`;
}

export function maskKey(key) {
  if (!key) return '';
  if (key.length <= 16) return '****';
  return `${key.slice(0, 10)}…${key.slice(-6)}`;
}
