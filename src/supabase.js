// 精簡版 Supabase REST（PostgREST + Storage）客戶端，只依賴 Node 內建 fetch。
import fs from 'node:fs/promises';
import path from 'node:path';

export class SupabaseError extends Error {
  constructor(message, { status, code, details, hint } = {}) {
    super(message);
    this.name = 'SupabaseError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.hint = hint;
  }
}

const MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  zip: 'application/zip',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export function guessMime(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

export class SupabaseClient {
  constructor({ supabaseUrl, supabaseAnonKey, bucket }, { fetchImpl = globalThis.fetch, timeoutMs = 20000 } = {}) {
    if (!supabaseUrl || !supabaseAnonKey) throw new Error('尚未連線 Supabase：缺少 URL 或 anon key');
    this.url = supabaseUrl.replace(/\/+$/, '');
    this.key = supabaseAnonKey;
    this.bucket = bucket;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  headers(extra = {}) {
    return { apikey: this.key, Authorization: `Bearer ${this.key}`, ...extra };
  }

  async request(url, { method = 'GET', headers = {}, body } = {}) {
    let res;
    try {
      res = await this.fetch(url, {
        method,
        headers: this.headers(headers),
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const reason = err.name === 'TimeoutError' ? '連線逾時' : err.cause?.code || err.message;
      throw new SupabaseError(`無法連線 Supabase（${reason}）`);
    }
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!res.ok) {
      const info = data && typeof data === 'object' ? data : {};
      throw new SupabaseError(info.message || info.error || info.msg || `HTTP ${res.status}`, {
        status: res.status,
        code: info.code || info.statusCode,
        details: info.details,
        hint: info.hint,
      });
    }
    return { data, res };
  }

  restUrl(table, params = {}) {
    const url = new URL(`${this.url}/rest/v1/${encodeURIComponent(table)}`);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.append(k, String(v));
    }
    return url.toString();
  }

  /** 取得資料表全部資料（自動分頁）。order: 'col' / 'col.desc' / 'col.asc.nullslast' */
  async select(table, { columns = '*', order, filters = {}, limit, pageSize = 1000 } = {}) {
    const rows = [];
    let offset = 0;
    for (;;) {
      const size = limit ? Math.min(pageSize, limit - rows.length) : pageSize;
      const params = { select: columns, ...filters, limit: size, offset };
      if (order) params.order = order;
      const { data } = await this.request(this.restUrl(table, params));
      rows.push(...(data || []));
      if (!data || data.length < size || (limit && rows.length >= limit)) break;
      offset += size;
    }
    return rows;
  }

  async count(table) {
    const { res } = await this.request(this.restUrl(table, { select: 'id', limit: 1 }), {
      headers: { Prefer: 'count=exact' },
    });
    const range = res.headers.get('content-range') || '';
    const total = Number(range.split('/')[1]);
    return Number.isFinite(total) ? total : 0;
  }

  async insert(table, rows) {
    const { data } = await this.request(this.restUrl(table, { select: '*' }), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
    });
    return data || [];
  }

  async update(table, id, patch) {
    const { data } = await this.request(this.restUrl(table, { id: `eq.${id}`, select: '*' }), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    if (!data || !data.length) throw new SupabaseError('更新失敗：找不到資料或沒有權限（RLS）');
    return data[0];
  }

  async remove(table, id) {
    const { data } = await this.request(this.restUrl(table, { id: `eq.${id}`, select: 'id' }), {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' },
    });
    if (!data || !data.length) throw new SupabaseError('刪除失敗：找不到資料或沒有權限（RLS）');
    return data[0];
  }

  // ---------- Storage ----------

  publicUrl(objectPath) {
    const encoded = objectPath.split('/').map(encodeURIComponent).join('/');
    return `${this.url}/storage/v1/object/public/${encodeURIComponent(this.bucket)}/${encoded}`;
  }

  async signedUrl(objectPath, expiresIn = 3600) {
    const encoded = objectPath.split('/').map(encodeURIComponent).join('/');
    const { data } = await this.request(`${this.url}/storage/v1/object/sign/${encodeURIComponent(this.bucket)}/${encoded}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn }),
    });
    const signed = data?.signedURL || data?.signedUrl;
    if (!signed) throw new SupabaseError('無法建立簽名網址');
    return `${this.url}/storage/v1${signed.startsWith('/') ? '' : '/'}${signed}`;
  }

  /** 把資料列中的檔案欄位轉成可開啟的網址：完整網址直接回傳，否則視為 bucket 內路徑。 */
  async resolveFileUrl(value, { sign = true } = {}) {
    if (!value) return null;
    if (/^(https?:|data:|blob:)/i.test(value)) return value;
    if (sign) {
      try {
        return await this.signedUrl(value);
      } catch {
        // 公開 bucket 或無簽名權限時，退回公開網址。
      }
    }
    return this.publicUrl(value);
  }

  async upload(localFile, folder) {
    const buffer = await fs.readFile(localFile);
    const base = path.basename(localFile).replace(/[^\w.-]+/g, '_');
    const objectPath = `${folder}/${Date.now()}_${base}`;
    const encoded = objectPath.split('/').map(encodeURIComponent).join('/');
    await this.request(`${this.url}/storage/v1/object/${encodeURIComponent(this.bucket)}/${encoded}`, {
      method: 'POST',
      headers: { 'Content-Type': guessMime(localFile), 'x-upsert': 'false' },
      body: buffer,
    });
    return { path: objectPath, size: buffer.length, type: guessMime(localFile) };
  }
}

export function friendlyError(err, table) {
  if (!(err instanceof SupabaseError)) return err.message || String(err);
  const text = `${err.message} ${err.details || ''} ${err.hint || ''}`;
  if (err.code === 'PGRST205' || err.code === '42P01' || /Could not find the table|does not exist/i.test(text)) {
    return `尚未建立 public.${table} 資料表。可執行 \`fengbro3 sql ${table}\` 取得建表 SQL，貼到 Supabase SQL Editor 執行。`;
  }
  if (err.status === 401 || err.status === 403 || err.code === '42501') {
    return `沒有權限（${err.message}）。請確認 anon key 與 RLS 政策。`;
  }
  return [err.message, err.details, err.hint].filter(Boolean).join(' — ');
}
