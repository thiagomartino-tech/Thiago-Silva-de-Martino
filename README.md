# Thiago Martino — site pessoal

Site de **Thiago Martino** com o nome escrito 10 vezes, feito para rodar na
**Cloudflare** (Workers + arquivos estáticos) e já preparado para a
**API de LLM da Nvidia** e o banco **Supabase**.

## Como está organizado

```
public/            arquivos estáticos (servidos pela Cloudflare)
  index.html       a página — o nome 10 vezes, assistente e mural
  styles.css
  app.js           só conversa com /api/*; nenhuma chave vai ao navegador
src/
  worker.js        rotas /api/*
  nvidia.js        chamadas à API de LLM da Nvidia (compatível com OpenAI)
  supabase.js      cliente mínimo do Supabase via REST (PostgREST)
supabase/
  schema.sql       tabela `messages` usada pelo mural
wrangler.toml      configuração da Cloudflare
```

## Rodar localmente

```bash
npm install
```

```bash
cp .dev.vars.example .dev.vars
```

Preencha `.dev.vars` (ele fica fora do git) e suba o servidor:

```bash
npm run dev
```

A página abre em `http://localhost:8787`. Sem credenciais, o site funciona:
o nome aparece 10 vezes e os cartões de assistente e mural avisam que a
integração ainda não está configurada.

## Publicar na Cloudflare

```bash
npx wrangler login
```

```bash
npm run deploy
```

## Configurar os segredos em produção

```bash
npx wrangler secret put NVIDIA_API_KEY
```

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

A URL do projeto Supabase e o modelo da Nvidia não são segredos e ficam em
`[vars]` no `wrangler.toml`:

- `SUPABASE_URL` — ex.: `https://xxxxxxxx.supabase.co`
- `NVIDIA_BASE_URL` — `https://integrate.api.nvidia.com/v1`
- `NVIDIA_MODEL` — ex.: `meta/llama-3.3-70b-instruct`

A chave da Nvidia sai de [build.nvidia.com](https://build.nvidia.com) → *Get API Key*.
A `service_role key` do Supabase está em *Project Settings → API*; ela só é usada
dentro do Worker, nunca no navegador.

## Banco de dados

No SQL Editor do Supabase, rode o conteúdo de `supabase/schema.sql` para criar
a tabela `messages`.

## Rotas da API

| Rota | Método | O que faz |
| --- | --- | --- |
| `/api/health` | GET | Diz se Nvidia e Supabase estão configurados |
| `/api/name` | GET | Devolve o nome repetido 10 vezes |
| `/api/chat` | POST | `{ "prompt": "..." }` → resposta do modelo da Nvidia |
| `/api/messages` | GET | Últimas 20 mensagens do mural |
| `/api/messages` | POST | `{ "author": "...", "content": "..." }` grava no Supabase |
