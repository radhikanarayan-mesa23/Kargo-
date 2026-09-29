-- Candidates: one row per applicant, deduped by email.
create type role_applied as enum ('pm', 'spm');

create type candidate_status as enum (
  'uploaded',
  'scoring',
  'scored',
  'needs_review',
  'advanced',
  'held',
  'declined'
);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  role_applied role_applied not null,
  name text,
  email text not null unique,
  phone text,
  cv_path text,
  cv_text_redacted text,
  status candidate_status not null default 'uploaded'
);

create index candidates_role_status_idx on candidates (role_applied, status);
