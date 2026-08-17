// Single source of truth for status → color across the vault grid, the stats
// dashboard, and the landing page's Plate mockup. Rose gold palette (Pass 2 of
// the rebrand) — the old set was gold/green/red/purple, which read as a status
// *traffic light*; these are five points around the rose gold hue instead, so
// the vault reads as one palette rather than five unrelated signals.
//
// Consumed as raw hex rather than CSS custom properties because recharts takes
// fill colors as JS strings, not computed styles.
export const STATUS_COLORS: Record<string, string> = {
  completed: '#C97684',
  in_progress: '#9B2F5C',
  plan_to_watch: '#A99BAE',
  on_hold: '#5B3E8C',
  dropped: '#6B6660',
}

// Readable text color for each background above. This lived in EntryList.tsx
// until the landing page's Plate mockup became a second consumer of the badge
// look — a background and the text color it requires are one decision, and
// splitting them across files is how they drift apart.
//
// Three of the five flipped in the rose gold migration, because the new
// palette redistributes lightness (in_progress went from a light green to a
// deep magenta, plan_to_watch from a dark red to a pale lilac, on_hold from a
// light lilac to a deep violet). Contrast against their own backgrounds, all
// comfortably past WCAG AA:
//   completed     #C97684 → dark text, 6.1:1
//   in_progress   #9B2F5C → light text, 6.4:1  (dark text would be 2.8:1)
//   plan_to_watch #A99BAE → dark text, 7.5:1   (light text would be 2.4:1)
//   on_hold       #5B3E8C → light text, 7.4:1  (dark text would be 2.4:1)
//   dropped       #6B6660 → light text, 5.0:1
export const STATUS_TEXT_COLORS: Record<string, string> = {
  completed: '#080808',
  in_progress: '#F2EFE9',
  plan_to_watch: '#080808',
  on_hold: '#F2EFE9',
  dropped: '#F2EFE9',
}
