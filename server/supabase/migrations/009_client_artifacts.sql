-- Client packs: shareable artifacts (SKU, PDF, images, folders)

alter table public.customers
  add column if not exists share_token text;

create unique index if not exists customers_share_token_idx
  on public.customers (share_token)
  where share_token is not null;

update public.customers
set share_token = replace(gen_random_uuid()::text, '-', '')
where share_token is null;

create table if not exists public.customer_artifacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_url text not null,
  file_type text,
  size_bytes int,
  sku text,
  folder_path text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists customer_artifacts_customer_id_idx
  on public.customer_artifacts (customer_id);

alter table public.customer_artifacts enable row level security;
