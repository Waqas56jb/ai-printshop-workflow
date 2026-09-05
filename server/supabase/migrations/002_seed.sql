-- AI Print Shop Workflow — seed data
-- Run after 001_schema.sql.

insert into public.stages (name, slug, color, position, is_default, is_final)
values
  ('Quote', 'quote', '#64748b', 1, true, false),
  ('Approved', 'approved', '#0ea5e9', 2, false, false),
  ('Artwork', 'artwork', '#8b5cf6', 3, false, false),
  ('Printing', 'printing', '#f59e0b', 4, false, false),
  ('QC', 'qc', '#eab308', 5, false, false),
  ('Ready', 'ready', '#22c55e', 6, false, false),
  ('Delivered', 'delivered', '#14b8a6', 7, false, true)
on conflict (slug) do nothing;

insert into public.settings (key, value)
values
  ('voice_auto_execute', 'true'::jsonb),
  ('voice_trigger_word', '""'::jsonb),
  ('board_refresh_seconds', '30'::jsonb),
  ('business_name', '"Print Shop"'::jsonb)
on conflict (key) do nothing;

-- After you create the first Auth user in Supabase, promote them:
-- update public.profiles set role = 'admin' where email = 'you@example.com';
