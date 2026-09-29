-- Drafts: AI-generated interview brief + one email draft per candidate/type.
-- The model never sees the real name; body_template carries a {{first_name}} placeholder
-- substituted only at send time.
create type draft_type as enum ('invite', 'decline');

create table drafts (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates (id) on delete cascade,
  type draft_type not null,
  subject text not null,
  body_template text not null,
  brief_md text not null,
  created_at timestamptz not null default now()
);

create index drafts_candidate_idx on drafts (candidate_id, type, created_at desc);
