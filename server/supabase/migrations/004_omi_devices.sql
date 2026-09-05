-- Unknown / assigned OMI devices heard by the webhook.

create table if not exists public.omi_devices (
  omi_uid text primary key,
  user_id uuid references public.profiles (id) on delete set null,
  first_heard_at timestamptz not null default now(),
  last_heard_at timestamptz not null default now()
);

create index if not exists omi_devices_user_id_idx on public.omi_devices (user_id);
create index if not exists omi_devices_last_heard_idx on public.omi_devices (last_heard_at desc);

alter table public.omi_devices enable row level security;

insert into public.omi_devices (omi_uid, user_id, first_heard_at, last_heard_at)
select omi_uid, id, now(), now()
from public.profiles
where omi_uid is not null
on conflict (omi_uid) do nothing;
