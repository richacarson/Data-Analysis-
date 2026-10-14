-- ETF sleeves (DVY, IUSG): the fund's holdings and weights, refreshed by the
-- nightly job from the issuer's published holdings file. Applied to project
-- ocovjbvrtbxptqtucyqw.
--
-- The job writes through this one function, guarded by the CRON_SECRET hash
-- and limited to keys starting "etf-", so it can never touch the sleeves
-- whose weights come from IC proposals.

create or replace function public.eq_record_etf_sleeve(
  p_secret text,
  p_key text,
  p_name text,
  p_sort integer,
  p_as_of date,
  p_source text,
  p_rows jsonb
)
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
  if p_key !~ '^etf-[a-z0-9]{1,10}$' then
    raise exception 'only etf- sleeves can be written here';
  end if;

  insert into public.eq_sleeves (key, name, sort)
  values (p_key, left(p_name, 80), p_sort)
  on conflict (key) do update set name = excluded.name, sort = excluded.sort;

  -- Holdings the fund no longer has drop to zero weight; the app skips them.
  update public.eq_sleeve_weights set weight = 0, as_of = p_as_of where sleeve_key = p_key;

  insert into public.eq_sleeve_weights (sleeve_key, symbol, weight, as_of, source)
  select p_key, upper(r.symbol), sum(r.weight), p_as_of, left(p_source, 120)
  from jsonb_to_recordset(p_rows) as r (symbol text, weight double precision)
  where r.symbol ~ '^[A-Za-z0-9.-]{1,12}$' and r.weight > 0
  group by upper(r.symbol)
  on conflict (sleeve_key, symbol) do update set weight = excluded.weight, as_of = excluded.as_of, source = excluded.source;

  get diagnostics written = row_count;
  return written;
end;
$$;

revoke all on function public.eq_record_etf_sleeve(text, text, text, integer, date, text, jsonb) from public;
grant execute on function public.eq_record_etf_sleeve(text, text, text, integer, date, text, jsonb) to anon, authenticated;
