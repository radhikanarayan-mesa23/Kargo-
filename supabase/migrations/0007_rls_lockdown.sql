-- Default-deny lockdown. The app never uses Supabase from the browser -- every
-- read/write goes through server-only route handlers / server components using
-- the service_role key, which bypasses RLS at the Postgres role level. Enabling
-- RLS here with zero policies for anon/authenticated means these tables are
-- completely unreachable from the browser even if a key were ever leaked to it.
alter table candidates enable row level security;
alter table scores enable row level security;
alter table drafts enable row level security;
alter table decisions enable row level security;
alter table emails enable row level security;
