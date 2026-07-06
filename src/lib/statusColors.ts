// Single source of truth for status → color across the vault grid and the
// stats dashboard. These values are EntryList's visually-tuned badge colors —
// StatsDashboard adopts them rather than the other way around.
export const STATUS_COLORS: Record<string, string> = {
  completed: '#D4AF6A',
  in_progress: '#4CAF82',
  plan_to_watch: '#C0392B',
  on_hold: '#B58DB6',
  dropped: '#6B6660',
}
