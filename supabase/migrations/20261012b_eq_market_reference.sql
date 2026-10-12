-- Reference figures typed in by the team, such as FactSet's 5- and 10-year
-- average forward P/E for the S&P 500 (from its weekly Earnings Insight).
-- Applied to project ocovjbvrtbxptqtucyqw. Isolated under the eq_ prefix.

create table if not exists public.eq_market_reference (
  key text primary key check (key ~ '^[a-z0-9_]{1,40}$'),
  value double precision not null check (value > 0 and value < 200),
  as_of date,
  source text check (char_length(source) <= 120),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

alter table public.eq_market_reference enable row level security;

create policy eq_market_reference_read on public.eq_market_reference
  for select to authenticated using (true);

create policy eq_market_reference_insert on public.eq_market_reference
  for insert to authenticated with check (updated_by = auth.uid());

create policy eq_market_reference_update on public.eq_market_reference
  for update to authenticated using (true) with check (updated_by = auth.uid());
