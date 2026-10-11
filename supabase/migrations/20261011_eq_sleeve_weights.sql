-- Position weights per sleeve, and sleeves defined only here (e.g. the
-- post-rebalance Dividend and Growth sleeves). Applied to project
-- ocovjbvrtbxptqtucyqw. The weights themselves come from confidential IC
-- proposals and are loaded directly, never committed.
create table if not exists public.eq_sleeves (
  key text primary key,
  name text not null,
  sort integer not null default 100,
  note text
);
create table if not exists public.eq_sleeve_weights (
  sleeve_key text not null,
  symbol text not null,
  weight double precision not null check (weight >= 0),
  as_of date not null,
  source text,
  primary key (sleeve_key, symbol)
);
alter table public.eq_sleeves enable row level security;
alter table public.eq_sleeve_weights enable row level security;
create policy eq_sleeves_read on public.eq_sleeves for select to authenticated using (true);
create policy eq_sleeve_weights_read on public.eq_sleeve_weights for select to authenticated using (true);

-- The morning warm-up and estimate recording also cover weighted holdings
-- (the post-rebalance buys are in no code-defined sleeve).
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
    select s.symbol from public.eq_estimate_snapshots s
    where s.snapshot_date > current_date - 90
    union
    select upper(w.symbol) from public.eq_watchlist_items w
    union
    select upper(sw.symbol) from public.eq_sleeve_weights sw;
end;
$$;
