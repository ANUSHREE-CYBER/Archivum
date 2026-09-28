// Per-type colours and labels, shared by the vault (section dots, card dots,
// the Continue stage's no-poster covers), the Add drawer's tabs and the Stats
// type bars — so a type's colour means the same thing everywhere. Moved here
// out of EntryList.tsx once a second component needed them.

// Muted/desaturated per-type wayfinding colors — deliberately distinct from the
// status palette in statusColors.ts. kdrama used to be #C48793, which sat at hue 348° —
// within 3° of both --color-accent (351°) and the new completed badge (350°),
// so a 9px kdrama dot would have read as a rose gold status cue. Moved to 319°,
// which is the midpoint between the rose it has to escape and the manga dot's
// 288° purple, so it collides with neither.
export const TYPE_DOT_COLORS: Record<string, string> = {
  movie:   '#6E8FA3',
  tv_show: '#5FA3A0',
  kdrama:  '#C173A8',
  anime:   '#C48F5A',
  book:    '#8A9A6B',
  manga:   '#9B7BA3',
  manhwa:  '#B07A5D',
}

export const TYPE_LABELS: Record<string, string> = {
  movie:   'Movie',
  tv_show: 'TV Show',
  kdrama:  'Kdrama',
  anime:   'Anime',
  book:    'Book',
  manga:   'Manga',
  manhwa:  'Manhwa',
}
