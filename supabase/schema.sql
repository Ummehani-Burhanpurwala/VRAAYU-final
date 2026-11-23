-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run
create table if not exists public.vraayu_state (
  id text primary key,            -- the 6-character family code
  data jsonb not null,            -- the elder's medicines, readings, events, contacts
  updated_at timestamptz not null default now()
);

-- Only the server (service role key) may read or write. Browsers can never touch this table directly.
alter table public.vraayu_state enable row level security;
