-- Staff + settings: profile extras, branding bucket, shop/board/job/notify keys.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_id_fkey;

alter table public.profiles alter column email drop not null;

alter table public.profiles add column if not exists job_title text;
alter table public.profiles add column if not exists last_active_at timestamptz;
alter table public.profiles add column if not exists invite_status text;

update public.profiles
set invite_status = case
  when is_active = false then 'inactive'
  else 'active'
end
where invite_status is null;

alter table public.profiles
  alter column invite_status set default 'invited';

alter table public.profiles
  alter column invite_status set not null;

alter table public.profiles drop constraint if exists profiles_invite_status_check;
alter table public.profiles add constraint profiles_invite_status_check
  check (invite_status in ('active', 'invited', 'inactive'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, invite_status)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'staff'),
    'invited'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.peek_next_job_number()
returns bigint
language sql
stable
as $$
  select last_value + case when is_called then 1 else 0 end
  from public.job_number_seq;
$$;

grant execute on function public.peek_next_job_number() to service_role, authenticated, anon;

-- ---------------------------------------------------------------------------
-- branding storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

drop policy if exists branding_public_read on storage.objects;
create policy branding_public_read on storage.objects
  for select using (bucket_id = 'branding');

-- ---------------------------------------------------------------------------
-- settings defaults
-- ---------------------------------------------------------------------------
insert into public.settings (key, value)
values
  ('business_logo_url', '""'::jsonb),
  ('phone', '""'::jsonb),
  ('address', '""'::jsonb),
  ('currency', '"PKR"'::jsonb),
  (
    'working_hours',
    '{"mon_fri":{"open":"09:00","close":"19:00"},"saturday":{"open":"10:00","close":"17:00"},"sunday":null}'::jsonb
  ),
  ('board_theme', '"dark"'::jsonb),
  ('board_card_size', '"normal"'::jsonb),
  ('board_show_customer', 'true'::jsonb),
  ('board_show_due', 'true'::jsonb),
  ('board_overdue_highlight', 'true'::jsonb),
  ('board_hide_delivered_after', '2'::jsonb),
  ('board_key', to_jsonb(encode(gen_random_bytes(12), 'hex'))),
  ('job_number_prefix', '"J-"'::jsonb),
  ('default_due_days', '3'::jsonb),
  ('default_priority', '"normal"'::jsonb),
  (
    'product_types',
    '["T-Shirt","Hoodie","Flyer","Business card","Banner","Sticker"]'::jsonb
  ),
  (
    'print_types',
    '["Screen print","DTF","DTG","Sublimation","Digital","Offset"]'::jsonb
  ),
  ('require_artwork_before_printing', 'true'::jsonb),
  ('notify_overdue_email', 'true'::jsonb),
  ('notify_pending_voice', 'true'::jsonb),
  ('notify_daily_summary', 'false'::jsonb),
  ('notify_email', '""'::jsonb)
on conflict (key) do nothing;
