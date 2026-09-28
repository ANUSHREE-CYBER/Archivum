import { TYPE_DOT_COLORS, TYPE_LABELS } from '../lib/typeColors'

// The designed cover for an entry with no poster (or one that failed to load):
// a glow in the type's dot colour over near-black, then type · title · ◆ rule
// · year stacked in the middle. Used by the Continue stage and the vault grid
// so a missing poster looks deliberate everywhere. `size` scales the title —
// 'lg' for the 210px stage card, 'md' for grid cards.
function CoverFallback({ type, title, year, size = 'md' }: {
  type: string
  title: string
  year: string | number | null
  size?: 'md' | 'lg'
}) {
  const dot = TYPE_DOT_COLORS[type] ?? '#6B6660'
  const lg = size === 'lg'
  return (
    <div
      className="cover-fallback"
      style={{
        gap: lg ? 14 : 10,
        padding: lg ? 20 : 14,
        background: `radial-gradient(circle at 30% 20%, ${dot}66, transparent 60%), linear-gradient(160deg, ${dot}33 0%, #0c0c0c 75%)`,
      }}
    >
      <span className="cover-fallback-type">{TYPE_LABELS[type] ?? type}</span>
      <span className="cover-fallback-title" style={{ fontSize: lg ? 22 : 17 }}>{title}</span>
      <span className="cover-fallback-rule" aria-hidden="true">
        <span />
        <span className="cover-fallback-diamond">◆</span>
        <span />
      </span>
      {year && <span className="cover-fallback-year">{year}</span>}
    </div>
  )
}

export default CoverFallback
