/**
 * Chamadas a API de LLM da Nvidia (build.nvidia.com).
 *
 * O endpoint e compativel com o formato da OpenAI
 * (POST /chat/completions), entao basta fetch — sem SDK.
 */

export class NvidiaNotConfiguredError extends Error {
  constructor() {
    super('API da Nvidia não configurada: defina o segredo NVIDIA_API_KEY.');
    this.name = 'NvidiaNotConfiguredError';
  }
}

export function isNvidiaConfigured(env) {
  return Boolean(env.NVIDIA_API_KEY);
}

const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct';

/**
 * @param {object} env bindings do Worker
 * @param {{messages: Array<{role: string, content: string}>, model?: string, temperature?: number, maxTokens?: number}} options
 * @returns {Promise<{content: string, model: string, usage: object|null}>}
 */
export async function chatCompletion(env, options) {
  if (!isNvidiaConfigured(env)) throw new NvidiaNotConfiguredError();

  const baseUrl = (env.NVIDIA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const model = options.model || env.NVIDIA_MODEL || DEFAULT_MODEL;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.5,
      max_tokens: options.maxTokens ?? 512,
      stream: false,
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Nvidia respondeu ${response.status}: ${body || '(sem corpo)'}`);
  }

  const data = JSON.parse(body);
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    model: data.model ?? model,
    usage: data.usage ?? null,
  };
}
