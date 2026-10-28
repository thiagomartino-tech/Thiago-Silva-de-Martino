/**
 * Cliente minimo do Supabase via API REST (PostgREST).
 *
 * Usa apenas fetch, entao roda no runtime da Cloudflare sem dependencias
 * e sem Node.js APIs. Quando o projeto crescer, pode ser trocado por
 * @supabase/supabase-js sem mudar as rotas do Worker.
 */

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super('Supabase não configurado: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
    this.name = 'SupabaseNotConfiguredError';
  }
}

export function isSupabaseConfigured(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createSupabaseClient(env) {
  if (!isSupabaseConfigured(env)) throw new SupabaseNotConfiguredError();

  const baseUrl = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1`;
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };

  async function request(path, init = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
    });

    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Supabase respondeu ${response.status}: ${body || '(sem corpo)'}`);
    }
    return body ? JSON.parse(body) : null;
  }

  return {
    /** SELECT com filtros no formato PostgREST, ex.: { order: 'created_at.desc', limit: '20' } */
    select(table, query = {}) {
      const params = new URLSearchParams({ select: '*', ...query });
      return request(`/${table}?${params}`);
    },

    /** INSERT devolvendo as linhas criadas. */
    insert(table, rows) {
      return request(`/${table}`, {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
      });
    },
  };
}
