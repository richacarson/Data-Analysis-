-- Daily consensus snapshots for estimate-revision history. Applied to project
-- ocovjbvrtbxptqtucyqw. Isolated under the eq_ prefix; touches no existing table.
--
-- FMP publishes today's consensus only, so revision history has to be recorded.
-- Writes go through one narrow function guarded by a shared secret rather than
-- the service-role key, which would bypass row-level security on every table in
-- this project, client data included.

create table if not exists public.eq_estimate_snapshots (
  symbol text not null,
  fiscal_date date not null,
  snapshot_date date not null,
  eps_avg double precision,
  eps_low double precision,
  eps_high double precision,
  revenue_avg double precision,
  revenue_low double precision,
  revenue_high double precision,
  analysts_eps integer,
  analysts_revenue integer,
  primary key (symbol, fiscal_date, snapshot_date)
);

create index if not exists eq_estimate_snapshots_symbol_date
  on public.eq_estimate_snapshots (symbol, snapshot_date desc);

alter table public.eq_estimate_snapshots enable row level security;

create policy eq_estimate_snapshots_read on public.eq_estimate_snapshots
  for select to authenticated using (true);

-- Not exposed through the API: only the function below reads it.
create schema if not exists eq_private;
revoke all on schema eq_private from public, anon, authenticated;

create table if not exists eq_private.writer_secret (
  id boolean primary key default true check (id),
  secret_hash bytea not null
);

create or replace function public.eq_record_estimate_snapshots(p_secret text, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  written integer;
begin
  if not exists (
    select 1 from eq_private.writer_secret
    where secret_hash = extensions.digest(p_secret, 'sha256')
  ) then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  insert into public.eq_estimate_snapshots as s (
    symbol, fiscal_date, snapshot_date, eps_avg, eps_low, eps_high,
    revenue_avg, revenue_low, revenue_high, analysts_eps, analysts_revenue
  )
  select
    upper(r.symbol), r.fiscal_date, r.snapshot_date, r.eps_avg, r.eps_low, r.eps_high,
    r.revenue_avg, r.revenue_low, r.revenue_high, r.analysts_eps, r.analysts_revenue
  from jsonb_to_recordset(p_rows) as r (
    symbol text, fiscal_date date, snapshot_date date,
    eps_avg double precision, eps_low double precision, eps_high double precision,
    revenue_avg double precision, revenue_low double precision, revenue_high double precision,
    analysts_eps integer, analysts_revenue integer
  )
  where r.symbol ~ '^[A-Za-z0-9.\-]{1,12}$'
  on conflict (symbol, fiscal_date, snapshot_date) do update set
    eps_avg = excluded.eps_avg,
    eps_low = excluded.eps_low,
    eps_high = excluded.eps_high,
    revenue_avg = excluded.revenue_avg,
    revenue_low = excluded.revenue_low,
    revenue_high = excluded.revenue_high,
    analysts_eps = excluded.analysts_eps,
    analysts_revenue = excluded.analysts_revenue;

  get diagnostics written = row_count;
  return written;
end;
$$;

revoke all on function public.eq_record_estimate_snapshots(text, jsonb) from public;
grant execute on function public.eq_record_estimate_snapshots(text, jsonb) to anon, authenticated;

-- Symbols to keep recording beyond the screen's universe: anything with a
-- snapshot in the past 90 days, i.e. any stock someone has opened.
create or replace function public.eq_tracked_symbols(p_secret text)
returns setof text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from eq_private.writer_secret
    where secret_hash = extensions.digest(p_secret, 'sha256')
  ) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  return query
    select distinct s.symbol from public.eq_estimate_snapshots s
    where s.snapshot_date > current_date - 90;
end;
$$;

revoke all on function public.eq_tracked_symbols(text) from public;
grant execute on function public.eq_tracked_symbols(text) to anon, authenticated;

-- The secret's hash is set separately, never committed:
-- insert into eq_private.writer_secret (secret_hash)
--   values (extensions.digest('<CRON_SECRET>', 'sha256'))
--   on conflict (id) do update set secret_hash = excluded.secret_hash;
