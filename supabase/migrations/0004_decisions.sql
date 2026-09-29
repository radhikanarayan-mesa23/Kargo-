-- Decisions: append-only audit trail of what Arjun decided, and when.
-- No email is ever sent without a decisions row existing first (enforced in app code too).
create type decision_type as enum ('advance', 'hold', 'decline');

create table decisions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates (id) on delete cascade,
  decision decision_type not null,
  note text,
  decided_at timestamptz not null default now()
);

create index decisions_candidate_idx on decisions (candidate_id, decided_at desc);

-- Belt-and-suspenders: the service_role key used server-side bypasses RLS entirely,
-- so RLS policies alone cannot guarantee append-only. This trigger blocks mutation
-- of history regardless of which Postgres role attempts it.
create function decisions_no_mutation() returns trigger as $$
begin
  raise exception 'decisions is append-only: % is not permitted', tg_op;
end;
$$ language plpgsql;

create trigger decisions_block_update_delete
  before update or delete on decisions
  for each row execute function decisions_no_mutation();
