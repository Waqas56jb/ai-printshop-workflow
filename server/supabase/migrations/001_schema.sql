-- AI Print Shop Workflow — schema
-- Run this in the Supabase SQL Editor first.
-- The Node server uses the service role key, which bypasses RLS.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role text not null check (role in ('admin', 'staff', 'worker')),
  omi_uid text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  company text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- stages
-- ---------------------------------------------------------------------------
create table if not exists public.stages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  color text not null default '#6366f1',
  position int not null,
  is_default boolean not null default false,
  is_final boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------------
create sequence if not exists public.job_number_seq start with 1025;

create or replace function public.generate_job_number()
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  n := nextval('public.job_number_seq');
  return 'J-' || n::text;
end;
$$;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  job_number text not null unique,
  customer_id uuid not null references public.customers (id) on delete restrict,
  title text not null,
  product_type text,
  quantity int not null default 1,
  print_type text,
  size_details text,
  price numeric,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  stage_id uuid not null references public.stages (id),
  assigned_to uuid references public.profiles (id) on delete set null,
  due_date date,
  notes text,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

create index if not exists jobs_stage_id_idx on public.jobs (stage_id);
create index if not exists jobs_due_date_idx on public.jobs (due_date);
create index if not exists jobs_customer_id_idx on public.jobs (customer_id);

-- ---------------------------------------------------------------------------
-- job_stage_history
-- ---------------------------------------------------------------------------
create table if not exists public.job_stage_history (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  from_stage_id uuid references public.stages (id) on delete set null,
  to_stage_id uuid not null references public.stages (id) on delete restrict,
  changed_by uuid references public.profiles (id) on delete set null,
  source text not null default 'manual' check (source in ('manual', 'voice')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- job_artworks
-- ---------------------------------------------------------------------------
create table if not exists public.job_artworks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_url text not null,
  file_type text,
  size_bytes int,
  version int not null default 1,
  is_approved boolean not null default false,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- job_notes
-- ---------------------------------------------------------------------------
create table if not exists public.job_notes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  content text not null,
  author_id uuid references public.profiles (id) on delete set null,
  source text not null default 'manual' check (source in ('manual', 'voice')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- voice_commands
-- ---------------------------------------------------------------------------
create table if not exists public.voice_commands (
  id uuid primary key default gen_random_uuid(),
  transcript text not null,
  omi_uid text,
  user_id uuid references public.profiles (id) on delete set null,
  intent jsonb,
  action text,
  status text not null check (status in ('executed', 'pending_confirmation', 'rejected', 'failed')),
  job_id uuid references public.jobs (id) on delete set null,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists voice_commands_created_at_idx on public.voice_commands (created_at desc);

-- ---------------------------------------------------------------------------
-- settings
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at
before update on public.settings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- auth.users → profiles
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'staff')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS (server uses service role and bypasses these policies)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.stages enable row level security;
alter table public.jobs enable row level security;
alter table public.job_stage_history enable row level security;
alter table public.job_artworks enable row level security;
alter table public.job_notes enable row level security;
alter table public.voice_commands enable row level security;
alter table public.settings enable row level security;

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles
  for select to authenticated using (true);

drop policy if exists customers_select_authenticated on public.customers;
create policy customers_select_authenticated on public.customers
  for select to authenticated using (true);

drop policy if exists stages_select_authenticated on public.stages;
create policy stages_select_authenticated on public.stages
  for select to authenticated using (true);

drop policy if exists jobs_select_authenticated on public.jobs;
create policy jobs_select_authenticated on public.jobs
  for select to authenticated using (true);

drop policy if exists settings_select_authenticated on public.settings;
create policy settings_select_authenticated on public.settings
  for select to authenticated using (true);

-- Public TV board can read stages + active job fields via the API (service role),
-- not directly from the browser.

-- ---------------------------------------------------------------------------
-- Storage bucket: artworks (public read)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('artworks', 'artworks', true)
on conflict (id) do update set public = true;

drop policy if exists artworks_public_read on storage.objects;
create policy artworks_public_read
on storage.objects
for select
to public
using (bucket_id = 'artworks');

grant usage, select on sequence public.job_number_seq to service_role, authenticated, anon;
grant execute on function public.generate_job_number() to service_role, authenticated, anon;
