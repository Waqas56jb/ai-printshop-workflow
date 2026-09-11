-- Store-computer network paths + proof / print-ready status

alter table public.customers
  add column if not exists network_folder text;

alter table public.customer_artifacts
  add column if not exists network_path text,
  add column if not exists revision int not null default 1,
  add column if not exists proof_status text not null default 'revision';

alter table public.customer_artifacts
  drop constraint if exists customer_artifacts_proof_status_check;

alter table public.customer_artifacts
  add constraint customer_artifacts_proof_status_check
  check (proof_status in ('revision', 'proof', 'approved', 'print_ready'));

alter table public.job_artworks
  add column if not exists network_path text;
