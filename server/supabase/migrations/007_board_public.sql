insert into public.settings (key, value)
values ('board_public', 'true'::jsonb)
on conflict (key) do nothing;
