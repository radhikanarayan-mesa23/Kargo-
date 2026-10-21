-- What actually happened after the invite.
--
-- The pipeline used to end at "invite email sent", which measures throughput
-- and nothing else. These columns are what make a shortlist judgeable after
-- the fact: did they interview, how did it go, was an offer made, did they
-- start, and were they any good once they did.
--
-- One mutable row per candidate rather than an append-only event log. This is
-- Arjun's own record-keeping, corrected as reality arrives over months, and
-- `decisions` already carries the audit trail that must never be rewritten.

create type interview_result as enum ('strong', 'mixed', 'weak', 'no_show');
create type offer_state as enum ('none', 'made', 'accepted', 'turned_down');
create type tenure_check as enum ('exceeding', 'meeting', 'struggling', 'left');

create table outcomes (
  candidate_id uuid primary key references candidates (id) on delete cascade,
  interviewed_on date,
  interview_result interview_result,
  offer offer_state not null default 'none',
  started_on date,
  check_90d tenure_check,
  note text,
  updated_at timestamptz not null default now()
);

create index outcomes_offer_idx on outcomes (offer);
create index outcomes_result_idx on outcomes (interview_result);

-- Same default-deny lockdown as every other table (see 0007): RLS on, zero
-- policies, so the browser cannot reach it even if a key leaked. All access
-- is server-only via the service_role key.
alter table outcomes enable row level security;
