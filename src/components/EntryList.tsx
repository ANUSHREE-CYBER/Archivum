import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import EntryEditModal, { STATUS_OPTIONS, statusLabel } from './EntryEditModal'
import type { EditableEntry } from './EntryEditModal'
import type { Tab } from './MediaSearch'
import Dropdown from './Dropdown'
import { STATUS_COLORS, STATUS_TEXT_COLORS } from '../lib/statusColors'
import { sharpPoster } from '../lib/utils'

// plan_to_watch/in_progress show combined labels in the filter since it covers all types
const STATUS_FILTER_OPTIONS = STATUS_OPTIONS.map(o => ({
  value: o.value,
  label:
    o.value === 'plan_to_watch' ? 'Plan to Watch / Read' :
    o.value === 'in_progress'   ? 'Watching / Reading' :
    o.label,
}))

// Sections match on type, but movie/tv_show also pick up entries of other
// types whose inferred format crosses over (e.g. an anime film under Movie).
// Kdrama is explicitly excluded from the TV Show crossover so it keeps its own
// section. Unchanged from the tab bar this replaced — the crossover rule is the
// same one, which is why an anime film legitimately renders in two sections.
function matchesTypeTab(entry: EditableEntry, tab: 'all' | Tab): boolean {
  if (tab === 'all') return true
  if (tab === 'movie') return entry.type === 'movie' || entry.format === 'movie'
  if (tab === 'tv_show') {
    if (entry.type === 'kdrama') return false
    return entry.type === 'tv_show' || entry.format === 'series'
  }
  return entry.type === tab
}

// Fixed render order for the continuous page. Not alphabetical and not the old
// tab order — this is the order the vault reads in, most-watched first.
const VAULT_SECTIONS: { value: Tab; label: string }[] = [
  { value: 'anime',   label: 'Anime' },
  { value: 'kdrama',  label: 'Kdrama' },
  { value: 'movie',   label: 'Movies' },
  { value: 'tv_show', label: 'TV' },
  { value: 'book',    label: 'Books' },
  { value: 'manga',   label: 'Manga' },
  { value: 'manhwa',  label: 'Manhwa' },
]

// Control glyphs. No icon library is installed — the only existing icon in the
// codebase is Dropdown's chevron, a hand-written 1.5px stroke SVG on
// currentColor, so these follow that idiom exactly rather than pulling in a
// dependency for three shapes. currentColor + .control-icon's opacity is what
// makes them track their label's colour through hover.
function ControlIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="control-icon"
    >
      {children}
    </svg>
  )
}

// Funnel — the one shape that reads as "filter" without a label
const StatusIcon = () => <ControlIcon><path d="M1.6 2.2h8.8L7.1 6.3v3.9L4.9 9V6.3L1.6 2.2Z" /></ControlIcon>
// Luggage-style tag, punch hole included, for the genre filter
const GenreIcon = () => (
  <ControlIcon>
    <path d="M1.6 1.6h4.6l4.2 4.2-4.6 4.6-4.2-4.2V1.6Z" />
    <circle cx="4" cy="4" r="0.85" />
  </ControlIcon>
)
// Ticked box — echoes the checkbox that appears on cards once Curate is on
const CurateIcon = () => (
  <ControlIcon>
    <rect x="1.6" y="1.6" width="8.8" height="8.8" rx="2.2" />
    <path d="M4.1 6.1 5.4 7.5 8 4.6" />
  </ControlIcon>
)

// Muted/desaturated per-type wayfinding colors — deliberately distinct from the
// status palette above. kdrama used to be #C48793, which sat at hue 348° —
// within 3° of both --color-accent (351°) and the new completed badge (350°),
// so a 9px kdrama dot would have read as a rose gold status cue. Moved to 319°,
// which is the midpoint between the rose it has to escape and the manga dot's
// 288° purple, so it collides with neither.
const TYPE_DOT_COLORS: Record<string, string> = {
  movie:   '#6E8FA3',
  tv_show: '#5FA3A0',
  kdrama:  '#C173A8',
  anime:   '#C48F5A',
  book:    '#8A9A6B',
  manga:   '#9B7BA3',
  manhwa:  '#B07A5D',
}

const TYPE_LABELS: Record<string, string> = {
  movie:   'Movie',
  tv_show: 'TV Show',
  kdrama:  'Kdrama',
  anime:   'Anime',
  book:    'Book',
  manga:   'Manga',
  manhwa:  'Manhwa',
}

// Only the whole-vault case survives the move to sections. The seven per-type
// messages ("No anime in your vault yet.") went with the tab bar: a section
// with nothing in it is now simply not rendered, so there is no per-type empty
// state left to word. See the section-visibility note in the render below.
function EmptyState() {
  return (
    <div className="flex items-center justify-center px-6" style={{ minHeight: '45vh' }}>
      {/* soft dark scrim so the muted text stays readable over bright aurora bands */}
      <div
        className="flex items-center gap-2.5 rounded-lg px-5 py-3"
        style={{ background: 'rgba(8,8,8,0.5)' }}
      >
        <p
          className="text-sm text-center"
          style={{ color: 'var(--color-text-muted)', textShadow: '0 1px 8px rgba(8,8,8,0.8)' }}
        >
          Your vault is empty. Add your first entry.
        </p>
      </div>
    </div>
  )
}

// Shown in place of EmptyState when the fetch itself failed and there's no
// cached data to fall back on — a failed fetch must never render as "empty".
function FetchErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-center px-6" style={{ minHeight: '45vh' }}>
      <div
        className="flex flex-col items-center gap-3 rounded-lg px-6 py-5"
        style={{ background: 'rgba(8,8,8,0.5)' }}
      >
        <p
          className="text-sm text-center"
          style={{ color: 'var(--color-danger)', textShadow: '0 1px 8px rgba(8,8,8,0.8)' }}
        >
          {message}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="text-xs font-semibold rounded px-4 py-2 cursor-pointer hover:opacity-90"
          style={{ background: 'var(--color-danger)', color: '#F2EFE9', border: 'none' }}
        >
          Retry
        </button>
      </div>
    </div>
  )
}

// Non-blocking banner for when the fetch failed but there's still previously-
// loaded data on screen — the vault stays usable, the user just knows a
// refresh didn't go through.
function FetchErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="px-6 pb-3">
      <div
        className="flex items-center gap-3 rounded-lg px-4 py-2.5"
        style={{ background: 'rgba(192,57,43,0.12)', border: '1px solid var(--color-danger)' }}
      >
        <p className="text-xs flex-1" style={{ color: 'var(--color-danger)' }}>{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="text-xs font-semibold rounded px-2.5 py-1 cursor-pointer hover:opacity-90 flex-shrink-0"
          style={{ background: 'var(--color-danger)', color: '#F2EFE9', border: 'none' }}
        >
          Retry
        </button>
      </div>
    </div>
  )
}

// Progress toward completion for in_progress entries, as 0–100, or null when it
// can't be computed. Each medium pairs a "current" metadata field with a "total":
// books store currentPage/totalPages (both editable in the modal today), while
// serials (episode/totalEpisodes) and manga/manhwa (chapter/totalChapters) only
// gain a bar once a total is present in metadata — no total, no bar, per spec.
function progressPercent(entry: EditableEntry): number | null {
  if (entry.status !== 'in_progress') return null
  const meta = (entry.metadata ?? {}) as Record<string, unknown>
  const num = (v: unknown) => (typeof v === 'number' && v > 0 ? v : null)

  let current: number | null
  let total: number | null
  if (entry.type === 'book') {
    current = num(meta.currentPage)
    total   = num(meta.totalPages)
  } else if (entry.type === 'manga' || entry.type === 'manhwa') {
    current = num(meta.chapter)
    total   = num(meta.totalChapters)
  } else {
    current = num(meta.episode)
    total   = num(meta.totalEpisodes)
  }

  if (current === null || total === null) return null
  return Math.min(100, (current / total) * 100)
}

// Entrance is plain CSS (transition + transition-delay), not Framer Motion —
// mixing FM's own transform ownership (from `layout`) with FM-driven entrance
// transforms was the source of the stagger timing bugs. Each card flips from
// .card-entering to .card-visible one frame after its own mount, so persisting
// cards (still mounted across a filter change) never replay the entrance —
// only newly-mounted cards do. The per-card transition-delay is what cascades.
//
// Since the vault became one continuous page, that flip also waits on the
// card's section being in view (EntryCard's `revealed` prop), so the cascade
// belongs to whichever band you've just scrolled to instead of all seven
// firing at once behind the fold. The index resets per section, so each one
// cascades from its own first card.
const CARD_STAGGER_STEP_MS = 40
const CARD_STAGGER_CAP_MS = 500

// 3D hover tilt. ±7° at the card edges — the hovered side lifts toward the
// cursor, like the card is turning to face where you're looking from.
// Evaluated once: tilt is meaningless without a real pointer, and this JS gate
// matches the CSS `.card-tilt` media query (same one the quick actions use).
const TILT_MAX_DEG = 7
const FINE_POINTER = window.matchMedia('(hover: hover) and (pointer: fine)').matches

function EntryCard({ entry, index, onClick, revealed = true, selectionMode, selected, onToggleSelect, onQuickStatus }: {
  entry: EditableEntry
  index: number
  onClick: () => void
  // Gates the entrance transition. Sections pass their own in-view state so a
  // section's cascade runs when it scrolls into view rather than all seven
  // sections firing at once on mount. Defaults true for the Continue shelf,
  // which is above the fold and animates on mount as it always has.
  revealed?: boolean
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
  onQuickStatus?: (next: string) => void
}) {
  const [imgError, setImgError] = useState(false)
  const [entered, setEntered] = useState(false)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const tiltRef = useRef<HTMLDivElement>(null)
  const tiltRafRef = useRef(0)
  const showFallback = !entry.poster_url || imgError
  const progress = progressPercent(entry)

  function handleActivate() {
    if (selectionMode) onToggleSelect?.()
    else onClick()
  }

  // One frame after the card is both mounted and revealed, flip to the visible
  // class so the CSS transition (and this card's stagger delay) actually runs —
  // setting both classes in the same frame would skip the transition entirely.
  useEffect(() => {
    if (!revealed) return
    const raf = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [revealed])

  // The transform is written straight to the DOM node instead of through
  // state — a state update would re-render the whole card on every frame of
  // mouse movement. Coalescing through requestAnimationFrame means at most
  // one geometry read + style write per frame no matter how fast the mouse
  // moves, and the rect is read fresh each time so scrolling (the Continue
  // shelf) never leaves the math stale.
  function handleTiltMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!FINE_POINTER || selectionMode) return
    const el = tiltRef.current
    if (!el) return
    const { clientX, clientY } = e
    cancelAnimationFrame(tiltRafRef.current)
    tiltRafRef.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect()
      const px = (clientX - rect.left) / rect.width - 0.5   // -0.5 … 0.5
      const py = (clientY - rect.top) / rect.height - 0.5
      el.style.transform =
        `perspective(800px) rotateX(${(py * TILT_MAX_DEG * 2).toFixed(2)}deg) rotateY(${(-px * TILT_MAX_DEG * 2).toFixed(2)}deg)`
    })
  }

  function handleTiltLeave() {
    cancelAnimationFrame(tiltRafRef.current)
    // Emptying the inline transform hands control back to the stylesheet
    // default (none); .card-tilt's transition eases the card flat again.
    if (tiltRef.current) tiltRef.current.style.transform = ''
  }

  // Entering selection mode mid-hover would otherwise freeze the card at
  // whatever angle it had — flatten it so checkboxes sit on a level grid.
  useEffect(() => {
    if (selectionMode) handleTiltLeave()
  }, [selectionMode])

  useEffect(() => () => cancelAnimationFrame(tiltRafRef.current), [])

  return (
    <div
      className={`w-full ${entered ? 'card-visible' : 'card-entering'}`}
      style={{ transitionDelay: `${Math.min(index * CARD_STAGGER_STEP_MS, CARD_STAGGER_CAP_MS)}ms` }}
    >
    {/* Dedicated tilt layer: this transform can't live on either neighbor.
        The stagger wrapper above transitions its own transform with a per-card
        delay (the tilt would inherit that delay), and Framer Motion owns the
        motion.div's transform for `layout` animations (it overwrites inline
        transforms). The glow, border, and poster zoom all live inside, so the
        whole card tilts as one object. */}
    <div
      ref={tiltRef}
      className="card-tilt"
      onMouseMove={handleTiltMove}
      onMouseLeave={handleTiltLeave}
    >
    {/* role="button" div rather than <button> — the hover overlay nests real
        <button>s inside, and buttons can't legally contain buttons */}
    <motion.div
      layout
      role="button"
      tabIndex={0}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ layout: { type: 'spring', stiffness: 200, damping: 25 } }}
      whileHover={{
        boxShadow: '0 0 20px 3px rgba(183,110,121,0.35)',
        transition: { duration: 0.3, ease: 'easeOut' },
      }}
      onClick={handleActivate}
      onKeyDown={e => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
          e.preventDefault()
          handleActivate()
        }
      }}
      onMouseLeave={() => setStatusMenuOpen(false)}
      className="group flex flex-col text-left cursor-pointer w-full overflow-hidden"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        boxShadow: '0 0 0px 0px rgba(183,110,121,0)',
        opacity: selectionMode && !selected ? 0.7 : 1,
        transition: 'opacity 0.2s ease',
      }}
    >
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '2/3' }}>
        {!showFallback ? (
          <img
            src={sharpPoster(entry.poster_url)!}
            alt={entry.title}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-[transform,filter] duration-300 ease-out group-hover:scale-105 group-hover:brightness-110"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center p-3 text-center"
            style={{ background: 'linear-gradient(180deg, #171717 0%, #0c0c0c 100%)' }}
          >
            <span
              className="leading-snug line-clamp-5"
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: 13,
                color: 'var(--color-text-muted)',
              }}
            >
              {entry.title}
            </span>
          </div>
        )}
        <span
          title={TYPE_LABELS[entry.type] ?? entry.type}
          className="absolute top-1.5 left-1.5 rounded-full"
          style={{
            width: 9,
            height: 9,
            background: TYPE_DOT_COLORS[entry.type] ?? 'var(--color-text-muted)',
            boxShadow: '0 0 0 2px rgba(8,8,8,0.7)',
          }}
        />
        {selectionMode && (
          <span
            className="absolute top-1.5 right-1.5 rounded-full flex items-center justify-center"
            style={{
              width: 20,
              height: 20,
              border: '2px solid var(--color-accent)',
              background: selected ? 'var(--color-accent)' : 'rgba(8,8,8,0.55)',
            }}
          >
            {selected && (
              <span style={{ color: 'var(--color-background)', fontSize: 12, lineHeight: 1, fontWeight: 700 }}>
                ✓
              </span>
            )}
          </span>
        )}
        {!selectionMode && (
          <div
            className="card-quick-actions absolute inset-x-0 bottom-0 flex items-end justify-center gap-2 pb-2"
            style={{ height: '40%', background: 'linear-gradient(to top, rgba(8,8,8,0.9), transparent)' }}
          >
            <div className="relative">
              <button
                type="button"
                className="quick-pill cursor-pointer"
                title="Change status"
                onClick={e => {
                  e.stopPropagation()
                  setStatusMenuOpen(open => !open)
                }}
              >
                ⟳
              </button>
              {statusMenuOpen && (
                <div className="quick-menu absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5">
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`quick-menu-item cursor-pointer ${opt.value === entry.status ? 'is-current' : ''}`}
                      onClick={e => {
                        e.stopPropagation()
                        setStatusMenuOpen(false)
                        if (opt.value !== entry.status) onQuickStatus?.(opt.value)
                      }}
                    >
                      {statusLabel(opt.value, entry.type)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="quick-pill cursor-pointer"
              title="Edit"
              onClick={e => {
                e.stopPropagation()
                onClick()
              }}
            >
              ✎
            </button>
          </div>
        )}
        {progress !== null && (
          <div
            className="absolute bottom-0 inset-x-0"
            style={{ height: 3, background: 'rgba(255,255,255,0.15)' }}
          >
            <div
              className="h-full"
              style={{ width: `${progress}%`, background: 'var(--color-accent)' }}
            />
          </div>
        )}
      </div>
      {/* Fixed-height rows (1-line title, always-rendered meta row) keep every
          card the same height so the badge lands in the same spot on each. */}
      <div className="flex flex-col gap-1.5 w-full" style={{ padding: '10px 12px 12px' }}>
        <span
          className="text-sm font-medium truncate w-full"
          title={entry.title}
          style={{ color: 'var(--color-text)' }}
        >
          {entry.title}
        </span>
        <div className="flex items-center justify-between w-full" style={{ height: 16 }}>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {entry.year ?? ''}
          </span>
          {entry.rating !== null && (
            <span
              className="text-xs font-medium flex items-center gap-1"
              style={{ color: 'rgba(183,110,121,0.8)' }}
            >
              <span aria-hidden="true" style={{ fontSize: 10 }}>★</span>
              {entry.rating}
            </span>
          )}
        </div>
        <span
          className="text-xs rounded-full px-2 py-0.5 self-start font-medium"
          style={{
            background: STATUS_COLORS[entry.status] ?? STATUS_COLORS.dropped,
            color: STATUS_TEXT_COLORS[entry.status] ?? STATUS_TEXT_COLORS.dropped,
          }}
        >
          {statusLabel(entry.status, entry.type)}
        </span>
      </div>
    </motion.div>
    </div>
    </div>
  )
}

// One labeled band of the continuous vault page. Only rendered when it has
// entries, so this never has to draw an empty state of its own.
function VaultSection({
  label, type, entries, selectionMode, selectedIds, onEdit, onToggleSelect, onQuickStatus,
}: {
  label: string
  type: Tab
  entries: EditableEntry[]
  selectionMode: boolean
  selectedIds: Set<string>
  onEdit: (entry: EditableEntry) => void
  onToggleSelect: (id: string) => void
  onQuickStatus: (entry: EditableEntry, next: string) => void
}) {
  const ref = useRef<HTMLElement>(null)
  // `amount` is the fraction of *this section* that must be visible, and a
  // section taller than the viewport can never reach a high ratio — 0.05 keeps
  // it reachable at any section height while still waiting for the band to
  // actually appear. once: true so scrolling back up doesn't replay it.
  const inView = useInView(ref, { once: true, amount: 0.05 })

  return (
    <section ref={ref} className="pb-6">
      <h2
        className="flex items-center gap-2.5 px-6 mb-2.5"
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          // same trick the old index tabs used — keeps the label legible where
          // a bright aurora band passes behind it
          textShadow: '0 1px 6px rgba(8, 8, 8, 0.9)',
        }}
      >
        <span
          aria-hidden="true"
          className="rounded-full flex-shrink-0"
          style={{
            width: 7,
            height: 7,
            background: TYPE_DOT_COLORS[type],
            boxShadow: '0 0 0 2px rgba(8,8,8,0.7)',
          }}
        />
        {label}
      </h2>

      <div
        className="grid gap-6 px-6"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
      >
        <AnimatePresence mode="popLayout">
          {entries.map((entry, i) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              index={i}
              revealed={inView}
              onClick={() => onEdit(entry)}
              selectionMode={selectionMode}
              selected={selectedIds.has(entry.id)}
              onToggleSelect={() => onToggleSelect(entry.id)}
              onQuickStatus={next => onQuickStatus(entry, next)}
            />
          ))}
        </AnimatePresence>
      </div>
    </section>
  )
}

// Two line segments with a 12px gap around the diamond — reads as one rule
// that breaks around the ornament, without needing a background patch to mask
// the line (a solid patch would show against the aurora).
function OrnamentDivider() {
  return (
    <div className="flex items-center px-6" style={{ margin: '10px 0 14px', gap: 12 }} aria-hidden="true">
      <span className="flex-1" style={{ height: 1, background: 'var(--color-border)' }} />
      <span style={{ color: 'var(--color-accent)', fontSize: 8, lineHeight: 1 }}>◆</span>
      <span className="flex-1" style={{ height: 1, background: 'var(--color-border)' }} />
    </div>
  )
}

function SkeletonCard() {
  return (
    <div
      className="flex flex-col w-full overflow-hidden"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
      }}
    >
      <div className="skeleton-shimmer w-full" style={{ aspectRatio: '2/3' }} />
      <div className="flex flex-col gap-1.5" style={{ padding: '10px 12px 12px' }}>
        <div className="skeleton-shimmer rounded" style={{ height: 14, width: '85%' }} />
        <div className="skeleton-shimmer rounded" style={{ height: 12, width: '30%' }} />
        <div className="skeleton-shimmer rounded-full" style={{ height: 18, width: 64 }} />
      </div>
    </div>
  )
}

function SkeletonShelf() {
  return (
    <div className="pb-4">
      <h2 className="text-sm font-semibold px-6 mb-2" style={{ color: 'var(--color-text)' }}>
        Continue
      </h2>
      <div className="flex gap-4 overflow-x-auto px-6 pb-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} style={{ width: 150, flexShrink: 0 }}>
            <div className="skeleton-shimmer rounded-xl w-full" style={{ aspectRatio: '2/3' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

interface Props {
  userId: string
  refreshKey: number
  // Entries state lives in App so the vault header can show live counts;
  // this component still owns fetching and all mutations via the setter.
  entries: EditableEntry[]
  setEntries: Dispatch<SetStateAction<EditableEntry[]>>
  // The identity half of the merged header. App computes the count line and
  // owns the Add drawer's open state and contents; EntryList owns the row they
  // share with the filter controls, since those controls' state lives here.
  countLine: string
  showAdd: boolean
  onToggleAdd: () => void
  addDrawer: ReactNode
  // Scroll-driven, computed in App because App owns <main>, the scroll container.
  collapsed: boolean
}

export default function EntryList({
  userId, refreshKey, entries, setEntries,
  countLine, showAdd, onToggleAdd, addDrawer, collapsed,
}: Props) {
  const [loading, setLoading]         = useState(true)
  const [fetchError, setFetchError]   = useState<string | null>(null)
  const [retryTick, setRetryTick]     = useState(0)
  const [editing, setEditing]         = useState<EditableEntry | null>(null)
  const [statusFilter, setStatusFilter]= useState('')
  const [genreFilter,  setGenreFilter] = useState('')
  const [selectionMode, setSelectionMode]     = useState(false)
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set())
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false)
  const [bulkDeleting, setBulkDeleting]       = useState(false)
  const [bulkDeleteError, setBulkDeleteError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase
      .from('entries')
      .select('id, title, year, poster_url, status, rating, type, format, metadata, genres')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        // Guard against a stale request (e.g. rapid refreshKey changes) resolving
        // after a newer one and flipping loading back off with outdated data.
        if (cancelled) return
        if (error) {
          // Leave entries untouched on failure — a fetch error must never look
          // like an empty vault, and any previously-loaded data stays visible.
          setFetchError("Couldn't load your vault. Check your connection and try again.")
        } else {
          setFetchError(null)
          setEntries(data ?? [])
        }
        setLoading(false)
      })
    return () => { cancelled = true }
    // setEntries is a useState setter from App, so it's referentially stable —
    // including it satisfies exhaustive-deps without ever re-running the effect
  }, [userId, refreshKey, retryTick, setEntries])

  const genres = useMemo(() => {
    const set = new Set<string>()
    entries.forEach(e => {
      e.genres?.forEach(g => set.add(g))
    })
    return [...set].sort()
  }, [entries])

  // Status/genre filters apply to the whole vault first; the result is then
  // split into sections, so a filter narrows what's in each section rather
  // than which sections exist.
  const filtered = useMemo(() => {
    let result = entries
    if (statusFilter) result = result.filter(e => e.status === statusFilter)
    if (genreFilter)  result = result.filter(e => e.genres?.includes(genreFilter) ?? false)
    return result
  }, [entries, statusFilter, genreFilter])

  // One bucket per type, always A–Z, empties dropped. An entry can legitimately
  // land in two buckets (an anime film matches both anime and movie) — that's
  // the crossover rule from the old tabs, and it's safe here because every
  // cross-section behaviour is keyed on entry id, not on card identity:
  // selection is a Set of ids, and bulk delete filters state by id, so both
  // renderings of an entry stay in lockstep and delete once.
  // .filter() already returns a fresh array, so sorting it in place is safe.
  const sections = useMemo(
    () =>
      VAULT_SECTIONS
        .map(section => ({
          ...section,
          entries: filtered
            .filter(e => matchesTypeTab(e, section.value))
            .sort((a, b) => a.title.localeCompare(b.title)),
        }))
        .filter(section => section.entries.length > 0),
    [filtered]
  )

  // Deliberately reads from `entries`, not `filtered`: the shelf has never
  // been narrowed by the status/genre dropdowns, only by the (now removed)
  // tab. Filtering it by status would be self-defeating anyway — picking any
  // status other than "Watching / Reading" would empty the shelf.
  const inProgress = useMemo(
    () => entries.filter(e => e.status === 'in_progress'),
    [entries]
  )

  function handleSaved(updated: Pick<EditableEntry, 'id' | 'status' | 'rating' | 'metadata'>) {
    setEntries(prev =>
      prev.map(e => e.id === updated.id ? { ...e, ...updated } : e)
    )
  }

  async function quickSetStatus(entry: EditableEntry, next: string) {
    const { data, error } = await supabase
      .from('entries')
      .update({ status: next })
      .eq('id', entry.id)
      .select('id')

    if (error) {
      toast.error(error.message, { style: { border: '1px solid var(--color-danger)' } })
      return
    }

    if ((data ?? []).length === 0) {
      // Zero rows matched — the entry was likely deleted elsewhere or blocked
      // by RLS. Don't claim success or update local state for a change that
      // never persisted; refetch so the grid reflects what's actually there.
      toast.error("Couldn't update status — entry may have been removed", {
        style: { border: '1px solid var(--color-danger)' },
      })
      setRetryTick(t => t + 1)
      return
    }

    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: next } : e))
    if (next === 'completed') {
      toast.success(`Marked ${entry.title} as Completed`, {
        icon: <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>✓</span>,
      })
    } else {
      toast.success(`Moved ${entry.title} to ${statusLabel(next, entry.type)}`)
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitSelectionMode() {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setConfirmingBulkDelete(false)
    setBulkDeleteError('')
  }

  async function handleBulkDelete() {
    if (bulkDeleting) return
    setBulkDeleting(true)
    setBulkDeleteError('')

    const ids = [...selectedIds]
    const { data, error } = await supabase.from('entries').delete().in('id', ids).select('id')

    setBulkDeleting(false)

    if (error) {
      setBulkDeleteError(error.message)
      toast.error(error.message, { style: { border: '1px solid var(--color-danger)' } })
      return
    }

    const deletedIds = new Set((data ?? []).map(row => row.id as string))
    const failedIds = ids.filter(id => !deletedIds.has(id))

    setEntries(prev => prev.filter(e => !deletedIds.has(e.id)))

    if (deletedIds.size > 0) {
      toast.success(`Deleted ${deletedIds.size} ${deletedIds.size === 1 ? 'entry' : 'entries'}`)
    }

    if (failedIds.length > 0) {
      const message = `Failed to delete ${failedIds.length} ${failedIds.length === 1 ? 'entry' : 'entries'}.`
      setBulkDeleteError(message)
      toast.error(message, { style: { border: '1px solid var(--color-danger)' } })
      setSelectedIds(new Set(failedIds))
      setConfirmingBulkDelete(false)
    } else {
      exitSelectionMode()
    }
  }

  return (
    <>
      {/* One merged row: identity left, every browsing control right. The
          identity block and the Add button come from App (which owns the
          drawer); the filters and Select live here because their state does.
          Wraps naturally on narrow windows via flex-wrap, same as the toolbar
          it replaced. */}
      <div className={`vault-header${showAdd ? ' has-drawer' : ''}${collapsed ? ' is-collapsed' : ''}`}>
        <div className="vault-header-identity">
          <h1 className="vault-header-title">The Vault</h1>
          {countLine && <span className="vault-header-count">{countLine}</span>}
        </div>

        <div className="vault-header-controls">
          <Dropdown
            ariaLabel="Filter by status"
            icon={<StatusIcon />}
            options={[{ value: '', label: 'Status' }, ...STATUS_FILTER_OPTIONS]}
            value={statusFilter}
            onChange={setStatusFilter}
          />

          {genres.length > 0 && (
            <Dropdown
              ariaLabel="Filter by genre"
              icon={<GenreIcon />}
              options={[{ value: '', label: 'Genre' }, ...genres.map(g => ({ value: g, label: g }))]}
              value={genreFilter}
              onChange={setGenreFilter}
            />
          )}

          <div className="flex gap-2 items-center">
          {confirmingBulkDelete ? (
            <>
              <span className="text-xs" style={{ color: 'var(--color-danger)' }}>
                Delete {selectedIds.size} {selectedIds.size === 1 ? 'entry' : 'entries'}? This can't be undone.
              </span>
              <button
                onClick={() => setConfirmingBulkDelete(false)}
                disabled={bulkDeleting}
                className="vault-control cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="vault-control is-danger cursor-pointer disabled:opacity-50"
              >
                {bulkDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </>
          ) : selectionMode ? (
            <>
              <span className="vault-control is-readout">
                {selectedIds.size} selected
              </span>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setConfirmingBulkDelete(true)}
                  className="vault-control is-danger cursor-pointer"
                >
                  Delete
                </button>
              )}
              <button
                onClick={exitSelectionMode}
                className="vault-control cursor-pointer"
              >
                Done
              </button>
            </>
          ) : (
            <button
              onClick={() => setSelectionMode(true)}
              className="vault-control cursor-pointer"
            >
              <CurateIcon />
              Curate
            </button>
          )}
          </div>

          <button onClick={onToggleAdd} className="vault-add-btn cursor-pointer">
            {showAdd ? 'Close' : '+ Archive'}
          </button>
        </div>
      </div>

      {addDrawer}

      {bulkDeleteError && (
        <p className="text-xs px-6 pb-2" style={{ color: 'var(--color-danger)' }}>{bulkDeleteError}</p>
      )}

      {/* Non-blocking: only shown when a failed refresh still left prior data
          on screen. When there's nothing to fall back on, FetchErrorState
          below takes over instead of the empty-vault message. */}
      {fetchError && entries.length > 0 && (
        <FetchErrorBanner message={fetchError} onRetry={() => setRetryTick(t => t + 1)} />
      )}

      <OrnamentDivider />

      {loading && (
        <>
          <SkeletonShelf />
          <div
            className="grid gap-6 px-6 pb-10"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
          >
            {Array.from({ length: 10 }, (_, i) => <SkeletonCard key={i} />)}
          </div>
        </>
      )}

      {!loading && entries.length === 0 && (
        fetchError
          ? <FetchErrorState message={fetchError} onRetry={() => setRetryTick(t => t + 1)} />
          : <EmptyState />
      )}

      {!loading && entries.length > 0 && inProgress.length > 0 && (
        <div className="pb-4">
          <h2 className="text-sm font-semibold px-6 mb-2" style={{ color: 'var(--color-text)' }}>
            Continue
          </h2>
          <div className="flex gap-4 overflow-x-auto px-6 pb-1">
            {inProgress.map((entry, i) => (
              <div key={entry.id} style={{ width: 150, flexShrink: 0 }}>
                <EntryCard
                  entry={entry}
                  index={i}
                  onClick={() => setEditing(entry)}
                  onQuickStatus={next => quickSetStatus(entry, next)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sections with nothing in them aren't rendered at all — no heading, no
          placeholder. That covers both "the filters excluded this type" and
          "you've never added one", deliberately: seven standing invitations on
          a new or narrow vault would be more absence than content, and on a
          continuous scroll a missing band reads as nothing rather than as a
          gap. The two cases that do need words are still handled — an entirely
          empty vault above, and filtered-to-nothing here. */}
      {!loading && entries.length > 0 && (sections.length === 0 ? (
        <p className="text-center text-sm mt-8 pb-10" style={{ color: 'var(--color-text-muted)' }}>
          No entries match these filters.
        </p>
      ) : (
        <div className="pb-10">
          {sections.map(section => (
            <VaultSection
              key={section.value}
              label={section.label}
              type={section.value}
              entries={section.entries}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onEdit={setEditing}
              onToggleSelect={toggleSelect}
              onQuickStatus={quickSetStatus}
            />
          ))}
        </div>
      ))}

      {editing && (
        <EntryEditModal
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={updated => {
            handleSaved(updated)
            setEditing(null)
          }}
          onDeleted={id => {
            setEntries(prev => prev.filter(e => e.id !== id))
            setEditing(null)
          }}
        />
      )}
    </>
  )
}
