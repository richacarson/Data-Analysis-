export interface WatchlistRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface WatchlistItemRow {
  id: string;
  watchlist_id: string;
  user_id: string;
  symbol: string;
  note: string | null;
  added_at: string;
}

export interface ValuationAssumptionsRow {
  id: string;
  user_id: string;
  symbol: string;
  discount_rate: number | null;
  terminal_growth: number | null;
  forecast_years: number | null;
  fcf_conversion: number | null;
  exit_multiple: number | null;
  notes: string | null;
  updated_at: string;
}
