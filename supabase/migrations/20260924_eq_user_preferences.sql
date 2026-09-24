-- Per-user settings for Equity Lens. Applied to project ocovjbvrtbxptqtucyqw.
-- Isolated under the eq_ prefix; touches no existing table.
create table if not exists public.eq_user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  chart_ids text[],
  updated_at timestamptz not null default now()
);

alter table public.eq_user_preferences enable row level security;

create policy eq_user_preferences_owner on public.eq_user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
