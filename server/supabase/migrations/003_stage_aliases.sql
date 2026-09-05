-- Stage aliases, board visibility, and extra voice settings.

alter table public.stages
  add column if not exists aliases text[] not null default '{}',
  add column if not exists show_on_board boolean not null default true;

update public.stages set aliases = array['quote', 'new'] where slug = 'quote' and (aliases is null or aliases = '{}');
update public.stages set aliases = array['approved', 'confirmed'] where slug = 'approved' and (aliases is null or aliases = '{}');
update public.stages set aliases = array['artwork', 'design', 'art'] where slug = 'artwork' and (aliases is null or aliases = '{}');
update public.stages set aliases = array['printing', 'press', 'print'] where slug = 'printing' and (aliases is null or aliases = '{}');
update public.stages set aliases = array['qc', 'quality check', 'checking'] where slug = 'qc' and (aliases is null or aliases = '{}');
update public.stages set aliases = array['ready', 'done', 'pickup'] where slug = 'ready' and (aliases is null or aliases = '{}');
update public.stages set aliases = array['delivered', 'collected'] where slug = 'delivered' and (aliases is null or aliases = '{}');

update public.stages set show_on_board = false where slug = 'delivered';

insert into public.settings (key, value)
values
  ('voice_confidence_threshold', '0.7'::jsonb),
  ('voice_reply_on_device', 'true'::jsonb),
  ('voice_language', '"auto"'::jsonb),
  ('voice_allow_skip', 'false'::jsonb)
on conflict (key) do nothing;
