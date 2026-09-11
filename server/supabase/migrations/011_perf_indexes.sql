-- Speed up list/dashboard/board filters
create index if not exists jobs_status_idx on public.jobs (status);
create index if not exists jobs_status_due_date_idx on public.jobs (status, due_date);
create index if not exists jobs_assigned_to_status_idx on public.jobs (assigned_to, status);
create index if not exists jobs_customer_id_idx on public.jobs (customer_id);
create index if not exists jobs_completed_at_idx on public.jobs (completed_at desc nulls last);
create index if not exists job_artworks_job_id_idx on public.job_artworks (job_id);
create index if not exists job_stage_history_job_created_idx on public.job_stage_history (job_id, created_at desc);
create index if not exists voice_commands_status_created_idx on public.voice_commands (status, created_at desc);
create index if not exists customers_created_at_idx on public.customers (created_at desc);
create index if not exists customers_name_idx on public.customers (name);
