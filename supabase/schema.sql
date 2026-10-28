-- Tabela usada pelo mural do site (rotas /api/messages).
-- Rode no SQL Editor do Supabase.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  author text not null default 'anônimo',
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists messages_created_at_idx
  on public.messages (created_at desc);

-- O Worker acessa com a service role key, que ignora RLS.
-- Mesmo assim deixamos RLS ligado e sem policies publicas, para que
-- a anon key (caso seja usada no futuro) nao leia nem escreva nada.
alter table public.messages enable row level security;
