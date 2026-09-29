-- Scores: one row per (candidate, rubric variant scored against).
-- A candidate can be scored on both pm and spm variants per G3 routing.
create type rubric_variant as enum ('pm', 'spm');

create type band as enum (
  'PRIORITY_SHORTLIST',
  'SHORTLIST',
  'HOLD',
  'DECLINE_QUEUE'
);

create table scores (
  candidate_id uuid not null references candidates (id) on delete cascade,
  rubric_variant rubric_variant not null,
  c1 int not null check (c1 between 0 and 4),
  c2 int not null check (c2 between 0 and 4),
  c3 int not null check (c3 between 0 and 4),
  c4 int not null check (c4 between 0 and 4),
  c5 int not null check (c5 between 0 and 4),
  confidence jsonb not null default '{}'::jsonb,
  quotes jsonb not null default '{}'::jsonb,
  gates jsonb not null default '{}'::jsonb,
  total numeric not null,
  band band not null,
  hidden_value jsonb not null default '[]'::jsonb,
  probes jsonb not null default '[]'::jsonb,
  risks jsonb not null default '{}'::jsonb,
  model text,
  created_at timestamptz not null default now(),
  primary key (candidate_id, rubric_variant)
);

create index scores_band_total_idx on scores (rubric_variant, band, total desc);
