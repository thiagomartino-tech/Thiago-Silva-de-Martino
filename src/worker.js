/**
 * Worker da Cloudflare para o site de Thiago Martino.
 *
 * Os arquivos de ./public sao servidos pela propria Cloudflare (binding ASSETS).
 * Este Worker cuida das rotas /api/*:
 *
 *   GET  /api/health    -> estado das integracoes
 *   GET  /api/name      -> o nome repetido 10 vezes (fonte da pagina)
 *   POST /api/chat      -> API de LLM da Nvidia
 *   GET  /api/messages  -> mensagens salvas no Supabase
 *   POST /api/messages  -> grava uma mensagem no Supabase
 */

import { chatCompletion, isNvidiaConfigured, NvidiaNotConfiguredError } from './nvidia.js';
import {
  createSupabaseClient,
  isSupabaseConfigured,
  SupabaseNotConfiguredError,
} from './supabase.js';

const FULL_NAME = 'Thiago Martino';
const NAME_REPETITIONS = 10;

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: JSON_HEADERS });
}

function errorResponse(error) {
  if (error instanceof NvidiaNotConfiguredError || error instanceof SupabaseNotConfiguredError) {
    return json({ error: error.message, code: 'not_configured' }, 503);
  }
  return json({ error: error.message || 'Erro inesperado.', code: 'internal_error' }, 500);
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    throw new Error('Corpo da requisição precisa ser JSON válido.');
  }
}

const routes = {
  'GET /api/health': (request, env) =>
    json({
      ok: true,
      name: FULL_NAME,
      repetitions: NAME_REPETITIONS,
      integrations: {
        nvidia: { configured: isNvidiaConfigured(env), model: env.NVIDIA_MODEL ?? null },
        supabase: { configured: isSupabaseConfigured(env) },
      },
    }),

  'GET /api/name': () =>
    json({
      name: FULL_NAME,
      repetitions: NAME_REPETITIONS,
      list: Array.from({ length: NAME_REPETITIONS }, () => FULL_NAME),
    }),

  'POST /api/chat': async (request, env) => {
    const body = await readJsonBody(request);
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) return json({ error: 'Envie um campo "prompt" com texto.' }, 400);
    if (prompt.length > 2000) return json({ error: 'O prompt passa de 2000 caracteres.' }, 400);

    const result = await chatCompletion(env, {
      messages: [
        {
          role: 'system',
          content: `Você é o assistente do site pessoal de ${FULL_NAME}. Responda em português do Brasil, de forma curta e direta.`,
        },
        { role: 'user', content: prompt },
      ],
    });
    return json(result);
  },

  'GET /api/messages': async (request, env) => {
    const supabase = createSupabaseClient(env);
    const rows = await supabase.select('messages', { order: 'created_at.desc', limit: '20' });
    return json({ messages: rows ?? [] });
  },

  'POST /api/messages': async (request, env) => {
    const body = await readJsonBody(request);
    const author = typeof body.author === 'string' ? body.author.trim() : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) return json({ error: 'Envie um campo "content" com texto.' }, 400);
    if (content.length > 1000) return json({ error: 'A mensagem passa de 1000 caracteres.' }, 400);

    const supabase = createSupabaseClient(env);
    const inserted = await supabase.insert('messages', {
      author: author || 'anônimo',
      content,
    });
    return json({ message: inserted?.[0] ?? null }, 201);
  },
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    const handler = routes[`${request.method} ${url.pathname}`];
    if (!handler) {
      const allowed = Object.keys(routes).filter((key) => key.endsWith(url.pathname));
      if (allowed.length > 0) {
        return json({ error: `Método não permitido em ${url.pathname}.`, allowed }, 405);
      }
      return json({ error: `Rota ${url.pathname} não existe.`, routes: Object.keys(routes) }, 404);
    }

    try {
      return await handler(request, env, ctx);
    } catch (error) {
      return errorResponse(error);
    }
  },
};
