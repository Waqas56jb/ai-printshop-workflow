-- Files explorer: user-made folders + loose shop files. Customer and job folders
-- are virtual (they mirror customers / jobs); job files stay in job_artworks.

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  customer_id uuid references public.customers (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete cascade,
  parent_id uuid references public.folders (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists folders_customer_id_idx on public.folders (customer_id);
create index if not exists folders_parent_id_idx on public.folders (parent_id);

create table if not exists public.shop_files (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references public.folders (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_url text,
  file_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists shop_files_folder_id_idx on public.shop_files (folder_id);
create index if not exists shop_files_customer_id_idx on public.shop_files (customer_id);

alter table public.folders enable row level security;
alter table public.shop_files enable row level security;

-- Private bucket: the API hands out short-lived signed links.
insert into storage.buckets (id, name, public)
values ('shop-files', 'shop-files', false)
on conflict (id) do nothing;
