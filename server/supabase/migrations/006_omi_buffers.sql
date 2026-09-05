-- Ephemeral transcript chunks. Needed on Vercel where each POST is a new isolate.
create table if not exists public.omi_buffers (
  buffer_key text primary key,
  texts jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.omi_buffers enable row level security;
