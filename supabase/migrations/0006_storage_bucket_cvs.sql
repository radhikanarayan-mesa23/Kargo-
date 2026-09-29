-- Private bucket for original CV files. Only the service-role key (server-side only)
-- can read/write here; no anon or authenticated storage policies are granted.
insert into storage.buckets (id, name, public)
values ('cvs', 'cvs', false)
on conflict (id) do nothing;
