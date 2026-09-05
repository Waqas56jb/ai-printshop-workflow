alter table public.voice_commands
  add column if not exists source text not null default 'voice';

alter table public.job_stage_history drop constraint if exists job_stage_history_source_check;
alter table public.job_stage_history
  add constraint job_stage_history_source_check check (source in ('manual', 'voice', 'realtime'));

alter table public.job_notes drop constraint if exists job_notes_source_check;
alter table public.job_notes
  add constraint job_notes_source_check check (source in ('manual', 'voice', 'realtime'));

insert into public.settings (key, value)
values
  ('voice_agent_enabled', 'true'::jsonb),
  ('voice_agent_voice', '"alloy"'::jsonb)
on conflict (key) do nothing;
