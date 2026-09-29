-- Emails: log of every send attempt. UNIQUE(candidate_id, type) is the idempotency
-- guard that makes it structurally impossible to send the same email twice.
create type email_mode as enum ('dry', 'live');

create table emails (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates (id) on delete cascade,
  type draft_type not null,
  mode email_mode not null,
  resend_id text,
  status text not null,
  error text,
  sent_at timestamptz not null default now(),
  unique (candidate_id, type)
);

create index emails_candidate_idx on emails (candidate_id);
