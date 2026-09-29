import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import EntryEditModal, { STATUS_OPTIONS, statusLabel } from './EntryEditModal'
import type { EditableEntry } from './EntryEditModal'
import type { Tab } from './MediaSearch'
import Dropdown from './Dropdown'
import { STATUS_COLORS, STATUS_TEXT_COLORS } from '../lib/statusColors'
import { TYPE_DOT_COLORS, TYPE_LABELS } from '../lib/typeColors'
import { progressKeys, readProgress } from '../lib/progress'
import ContinueStage from './ContinueStage'
import CoverFallback from './CoverFallback'
import { useTilt } from '../lib/useTilt'
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

// A comic is never a film or a show. ManualEntryModal no longer offers
// Movie/Series for these two types, but rows saved before that fix can still
// carry a stray format, and the column is nullable free-form as far as the
// database is concerned. So both crossover branches below exclude them
// outright — a hard floor, rather than an assumption about the data.
const COMIC_TYPES = new Set(['manga', 'manhwa'])

function matchesTypeTab(entry: EditableEntry, tab: Tab): boolean {
  if (tab === 'movie') {
    if (COMIC_TYPES.has(entry.type)) return false
    return entry.type === 'movie' || entry.format === 'movie'
  }
  if (tab === 'tv_show') {
    if (COMIC_TYPES.has(entry.type)) return false
    // Kdrama and anime own their sections outright. Both get format 'series'
    // automatically on import (TMDB tv → 'series', AniList TV/OVA/ONA →
    // 'series'), so without this guard every anime series would render a
    // second time under TV Show purely as a side effect of how it was
    // imported — nobody asked for it there.
    //
    // The asymmetry with the Movies branch above is deliberate, not an
    // oversight: an anime *film* still crosses into Movies. A film is a film
    // regardless of where it was made, and that crossover is the whole reason
    // the format column exists. A series, though, already has a section of its
    // own, so crossing it into TV Show only duplicates it.
    if (entry.type === 'kdrama' || entry.type === 'anime') return false
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

// Only the whole-vault case survives the move to sections. The seven per-type
// messages ("No anime in your vault yet.") went with the tab bar: a section
// with nothing in it is now simply not rendered, so there is no per-type empty
// state left to word. See the section-visibility note in the render below.
// Wraps a filter Dropdown so it can show that a filter is set: the trigger
// takes the rose "active" skin (via .filter-control.is-active in index.css)
// and a small × badge clears it. The badge is a sibling of the Dropdown, not
// inside it — the trigger is a <button>, and a button can't contain another.
function FilterControl({ active, onClear, label, children }: {
  active: boolean
  onClear: () => void
  label: string
  children: ReactNode
}) {
  return (
    <div className={`filter-control${active ? ' is-active' : ''}`}>
      {children}
      {active && (
        <button
          onClick={e => {
            e.stopPropagation()
            onClear()
          }}
          className="filter-clear cursor-pointer"
          aria-label={`Clear ${label} filter`}
          title="Clear"
        >
          ×
        </button>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center px-6" style={{ minHeight: '45vh' }}>
      {/* soft dark scrim so the muted text stays readable over the backdrop */}
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
// can't be computed (no current + total pair in metadata — no total, no bar).
// Which fields hold it per medium lives in lib/progress.ts, shared with the
// Continue stage and the edit modal.
function progressPercent(entry: EditableEntry): number | null {
  if (entry.status !== 'in_progress') return null
  return readProgress(entry)?.percent ?? null
}

// A card is three stacked layers, each owning exactly one transform:
//   1. .shelf-reveal — the one-time 3D entrance (rises out of the shelf),
//      toggled by its section's IntersectionObserver. Its transition carries
//      a per-card delay, so nothing else may transform this element.
//   2. .card-tilt — the hover tilt + lift, written per frame by useTilt.
//   3. the Framer Motion `layout` card — FM owns and overwrites its inline
//      transform for layout/exit animations.
// Merging any two of these makes one clobber the other (a delayed tilt, a
// tilt wiped by FM, a reveal that replays on layout) — keep them separate.
function EntryCard({ entry, onClick, registerReveal, selectionMode, selected, onToggleSelect, onQuickStatus }: {
  entry: EditableEntry
  onClick: () => void
  // Hands the reveal wrapper to the section's shared IntersectionObserver
  registerReveal: (el: HTMLDivElement | null) => void
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
  onQuickStatus?: (next: string) => void
}) {
  const [imgError, setImgError] = useState(false)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const showFallback = !entry.poster_url || imgError
  const progress = progressPercent(entry)
  // ±7° at the edges, lifted 30px toward the viewer, with a pale rose glare
  // under the pointer. Off in selection mode so checkboxes sit on a level row.
  const { tiltRef, glareRef, onMouseMove, onMouseLeave } = useTilt({
    max: 7,
    lift: 'translateZ(30px) translateY(-6px)',
    glare: 0.28,
    disabled: selectionMode,
  })

  function handleActivate() {
    if (selectionMode) onToggleSelect?.()
    else onClick()
  }

  // Entering selection mode mid-hover would otherwise freeze the card at
  // whatever angle it had — flatten it
  useEffect(() => {
    if (selectionMode) onMouseLeave()
  }, [selectionMode, onMouseLeave])

  return (
    <div ref={registerReveal} className="shelf-reveal">
    {/* Tilt layer — see the three-layer note above EntryCard */}
    <div
      ref={tiltRef}
      className="card-tilt"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
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
        border: `1px solid ${selectionMode && selected ? '#B76E79' : 'var(--color-border)'}`,
        borderRadius: 12,
        boxShadow: '0 0 0px 0px rgba(183,110,121,0)',
        opacity: selectionMode && !selected ? 0.75 : 1,
        transition: 'opacity 0.2s ease, border-color 0.2s ease',
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
            className="shelf-poster w-full h-full object-cover"
          />
        ) : (
          <CoverFallback type={entry.type} title={entry.title} year={entry.year} />
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
    <div ref={glareRef} className="card-glare" aria-hidden="true" />
    </div>
    </div>
  )
}

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const REVEAL_STAGGER_MS = 70
const REVEAL_STAGGER_CAP = 8

// One labeled shelf of the continuous vault page: a heading, then a single
// horizontally scrolling row of cards. Only rendered when it has entries, so
// it never draws an empty state of its own.
//
// Reveal: one IntersectionObserver per section watches every card's reveal
// wrapper, with <main> as the root (the vault scrolls <main>, not the
// window). It fires per card, once — including cards further along the row,
// which the row's own overflow keeps out of view until you scroll to them.
// Cards that arrive in the same batch stagger by 70ms each, capped at 8.
// The class is added straight to the DOM rather than through state, so a
// reveal never re-renders the card.
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
  const sectionRef = useRef<HTMLElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  // Cards can mount before the observer exists (children's refs attach
  // before the parent's effect runs), so they queue here until it does
  const pendingRef = useRef<Set<HTMLDivElement>>(new Set())

  useEffect(() => {
    const root = sectionRef.current?.closest('main') ?? null
    const observer = new IntersectionObserver(records => {
      let k = 0
      for (const r of records) {
        if (!r.isIntersecting) continue
        const el = r.target as HTMLElement
        el.style.transitionDelay = `${Math.min(k++, REVEAL_STAGGER_CAP) * REVEAL_STAGGER_MS}ms`
        el.classList.add('is-revealed')
        observer.unobserve(el)
      }
    }, { root, threshold: 0.1 })
    observerRef.current = observer
    pendingRef.current.forEach(el => observer.observe(el))
    pendingRef.current.clear()
    return () => observer.disconnect()
  }, [])

  // Stable callback ref for every card's reveal wrapper
  const registerReveal = useCallback((el: HTMLDivElement | null) => {
    if (!el || el.classList.contains('is-revealed')) return
    if (REDUCED_MOTION) {
      el.classList.add('is-revealed')
      return
    }
    if (observerRef.current) observerRef.current.observe(el)
    else pendingRef.current.add(el)
  }, [])

  return (
    <section ref={sectionRef} className="shelf">
      <h2 className="shelf-heading">
        <span aria-hidden="true" className="shelf-heading-dot" style={{ background: TYPE_DOT_COLORS[type] }} />
        {label}
        <span className="shelf-heading-count">{entries.length}</span>
        <span aria-hidden="true" className="shelf-heading-rule" />
      </h2>

      {/* layoutScroll: this row scrolls horizontally, and Framer Motion needs
          to know so its layout measurements account for the scroll offset */}
      <motion.div layoutScroll className="shelf-row">
        <AnimatePresence mode="popLayout">
          {entries.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              registerReveal={registerReveal}
              onClick={() => onEdit(entry)}
              selectionMode={selectionMode}
              selected={selectedIds.has(entry.id)}
              onToggleSelect={() => onToggleSelect(entry.id)}
              onQuickStatus={next => onQuickStatus(entry, next)}
            />
          ))}
        </AnimatePresence>
      </motion.div>
    </section>
  )
}

// Poster parallax for every shelf card: each poster sits scaled up 14% inside
// its frame and drifts vertically against the scroll, by up to 6% of its
// height, depending on how far its centre is from the middle of the window.
// One passive scroll listener on <main>, coalesced to one rAF per frame, and
// only posters actually near the viewport are written.
function useShelfParallax(rootRef: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || REDUCED_MOTION) return
    const main = rootRef.current?.closest('main')
    if (!main) return
    let raf = 0
    function update() {
      raf = 0
      const H = window.innerHeight
      // All reads first, then all writes. Interleaving them (read a rect,
      // write a transform, read the next rect…) forces a style recalc per
      // poster, every scroll frame. The rect is the poster's frame, not the
      // image itself, so the parallax never measures its own transform.
      const imgs = Array.from(main!.querySelectorAll<HTMLImageElement>('.shelf-poster'))
      const rects = imgs.map(img => img.parentElement!.getBoundingClientRect())
      imgs.forEach((img, i) => {
        const r = rects[i]
        if (r.bottom < -H * 0.5 || r.top > H * 1.5) return
        const off = Math.max(-1, Math.min(1, (r.top + r.height / 2 - H / 2) / H))
        img.style.transform = `scale(1.14) translateY(${(off * -6).toFixed(2)}%)`
      })
    }
    function schedule() {
      if (!raf) raf = requestAnimationFrame(update)
    }
    schedule()
    main.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(raf)
      main.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [rootRef, active])
}

// Two line segments with a 12px gap around the diamond — reads as one rule
// that breaks around the ornament, without needing a background patch to mask
// the line (a solid patch would show against the backdrop).
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
      className="flex flex-col overflow-hidden"
      style={{
        width: 190,
        flexShrink: 0,
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

// Placeholder with the Continue stage's footprint, so the page doesn't jump
// when the real stage arrives
function SkeletonStage() {
  return (
    <div className="skeleton-shimmer" style={{ margin: '8px 24px 34px', minHeight: 440, borderRadius: 18 }} />
  )
}

interface Props {
  userId: string
  refreshKey: number
  // Entries state lives in App (the backdrop reads its posters); this
  // component still owns fetching and all mutations via the setter.
  entries: EditableEntry[]
  setEntries: Dispatch<SetStateAction<EditableEntry[]>>
  // App owns the Add drawer's open state and contents; EntryList owns the
  // header row they share with the filter controls, since that state lives here.
  showAdd: boolean
  onToggleAdd: () => void
  addDrawer: ReactNode
  // Scroll-driven, computed in App because App owns <main>, the scroll container.
  collapsed: boolean
}

export default function EntryList({
  userId, refreshKey, entries, setEntries,
  showAdd, onToggleAdd, addDrawer, collapsed,
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

  // Reads from `entries`, not `filtered`. The Continue stage isn't narrowed
  // by the filters — it's hidden entirely while any filter is set (see the
  // render below), since a filtered view is a search, not a place to resume.
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

  // +1 episode / chapter / page from the Continue stage. Same checked update
  // path as quickSetStatus: .select('id') so a zero-row update (deleted
  // elsewhere, or RLS) is reported instead of silently "succeeding". Reaching
  // the known total clamps to it and marks the entry completed, which drops
  // it out of the stage. Without a total it just counts up.
  const bumpingRef = useRef(false)
  async function bumpProgress(entry: EditableEntry) {
    const keys = progressKeys(entry.type)
    if (!keys || bumpingRef.current) return
    bumpingRef.current = true

    const meta = (entry.metadata ?? {}) as Record<string, unknown>
    const current = typeof meta[keys.current] === 'number' ? (meta[keys.current] as number) : 0
    const total = typeof meta[keys.total] === 'number' && (meta[keys.total] as number) > 0
      ? (meta[keys.total] as number)
      : null
    let next = current + 1
    let status = entry.status
    if (total !== null && next >= total) {
      next = total
      status = 'completed'
    }
    const metadata = { ...meta, [keys.current]: next }

    const { data, error } = await supabase
      .from('entries')
      .update({ metadata, status })
      .eq('id', entry.id)
      .select('id')
    bumpingRef.current = false

    if (error) {
      toast.error(error.message, { style: { border: '1px solid var(--color-danger)' } })
      return
    }
    if ((data ?? []).length === 0) {
      toast.error("Couldn't update progress — entry may have been removed", {
        style: { border: '1px solid var(--color-danger)' },
      })
      setRetryTick(t => t + 1)
      return
    }

    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, metadata, status } : e))
    if (status === 'completed') {
      toast.success(`Marked ${entry.title} as Completed`, {
        icon: <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>✓</span>,
      })
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

  // Poster parallax across all shelves; re-bound when the shelves (re)mount
  const shelvesRef = useRef<HTMLDivElement>(null)
  useShelfParallax(shelvesRef, !loading && sections.length > 0)

  const countChips = useMemo(() => {
    const completed  = entries.filter(e => e.status === 'completed').length
    const inProgress = entries.filter(e => e.status === 'in_progress').length
    return [
      { status: '', color: '#6B6660', count: entries.length, label: `${entries.length} ${entries.length === 1 ? 'title' : 'titles'}` },
      { status: 'completed', color: STATUS_COLORS.completed, count: completed, label: `${completed} completed` },
      { status: 'in_progress', color: STATUS_COLORS.in_progress, count: inProgress, label: `${inProgress} in progress` },
    ].filter(chip => chip.count > 0)
  }, [entries])

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
          {/* Counts are over the whole vault (not the filtered view), and
              double as shortcuts: completed / in progress toggle the Status
              filter. The titles chip has no filter of its own, so it clears
              Status instead. Zero counts are hidden, as before. */}
          {countChips.length > 0 && (
            <span className="vault-header-count">
              {countChips.map(chip => (
                <button
                  key={chip.label}
                  onClick={() => setStatusFilter(prev => (chip.status && prev !== chip.status ? chip.status : ''))}
                  className={`count-chip cursor-pointer${chip.status && statusFilter === chip.status ? ' is-active' : ''}`}
                  aria-pressed={chip.status ? statusFilter === chip.status : undefined}
                >
                  <span className="count-chip-dot" style={{ background: chip.color }} />
                  {chip.label}
                </button>
              ))}
            </span>
          )}
        </div>

        <div className="vault-header-controls">
          <FilterControl active={statusFilter !== ''} onClear={() => setStatusFilter('')} label="status">
            <Dropdown
              ariaLabel="Filter by status"
              icon={<StatusIcon />}
              options={[{ value: '', label: 'Status' }, ...STATUS_FILTER_OPTIONS]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </FilterControl>

          {genres.length > 0 && (
            <FilterControl active={genreFilter !== ''} onClear={() => setGenreFilter('')} label="genre">
              <Dropdown
                ariaLabel="Filter by genre"
                icon={<GenreIcon />}
                options={[{ value: '', label: 'Genre' }, ...genres.map(g => ({ value: g, label: g }))]}
                value={genreFilter}
                onChange={setGenreFilter}
              />
            </FilterControl>
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
          <SkeletonStage />
          <div className="shelf-row" style={{ overflow: 'hidden' }}>
            {Array.from({ length: 8 }, (_, i) => <SkeletonCard key={i} />)}
          </div>
        </>
      )}

      {!loading && entries.length === 0 && (
        fetchError
          ? <FetchErrorState message={fetchError} onRetry={() => setRetryTick(t => t + 1)} />
          : <EmptyState />
      )}

      {!loading && inProgress.length > 0 && !statusFilter && !genreFilter && (
        <ContinueStage entries={inProgress} onOpen={setEditing} onBump={bumpProgress} />
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
        <div ref={shelvesRef} className="pb-10">
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
