-- Daily bottom-up index snapshots (S&P 500 forward P/E, earnings growth, sector
-- and top-10 breakdowns). Applied to project ocovjbvrtbxptqtucyqw. Isolated
-- under the eq_ prefix; touches no existing table.
--
-- One row per index per day. Writes go through the function below, guarded by
-- the same CRON_SECRET hash as eq_record_estimate_snapshots.

create table if not exists public.eq_market_snapshots (
  index_key text not null,
  snapshot_date date not null,
  payload jsonb not null,
  primary key (index_key, snapshot_date)
);

alter table public.eq_market_snapshots enable row level security;

create policy eq_market_snapshots_read on public.eq_market_snapshots
  for select to authenticated using (true);

create or replace function public.eq_record_market_snapshot(
  p_secret text,
  p_index text,
  p_date date,
  p_payload jsonb
)
returns void
language plpgsql
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

  if p_index !~ '^[a-z0-9_]{1,24}$' then
    raise exception 'bad index key';
  end if;

  insert into public.eq_market_snapshots (index_key, snapshot_date, payload)
  values (p_index, p_date, p_payload)
  on conflict (index_key, snapshot_date) do update set payload = excluded.payload;
end;
$$;

revoke all on function public.eq_record_market_snapshot(text, text, date, jsonb) from public;
grant execute on function public.eq_record_market_snapshot(text, text, date, jsonb) to anon, authenticated;
