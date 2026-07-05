import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import EntryEditModal, { STATUS_OPTIONS, statusLabel } from './EntryEditModal'
import type { EditableEntry } from './EntryEditModal'
import type { Tab } from './MediaSearch'
import Dropdown from './Dropdown'

const SORT_OPTIONS = [
  { value: 'newest',    label: 'Newest Added' },
  { value: 'year_desc', label: 'Year (newest first)' },
  { value: 'year_asc',  label: 'Year (oldest first)' },
  { value: 'title_az',  label: 'Title (A–Z)' },
]

// plan_to_watch/in_progress show combined labels in the filter since it covers all types
const STATUS_FILTER_OPTIONS = STATUS_OPTIONS.map(o => ({
  value: o.value,
  label:
    o.value === 'plan_to_watch' ? 'Plan to Watch / Read' :
    o.value === 'in_progress'   ? 'Watching / Reading' :
    o.label,
}))

function sharpPoster(url: string | null): string | null {
  if (!url || !url.includes('image.tmdb.org')) return url
  return url.replace('/w92', '/w342')
}

// Tabs match on type, but movie/tv_show also pick up entries of other
// types whose inferred format crosses over (e.g. an anime film under Movie).
// Kdrama is explicitly excluded from the TV Show crossover so it stays in its own tab.
function matchesTypeTab(entry: EditableEntry, tab: 'all' | Tab): boolean {
  if (tab === 'all') return true
  if (tab === 'movie') return entry.type === 'movie' || entry.format === 'movie'
  if (tab === 'tv_show') {
    if (entry.type === 'kdrama') return false
    return entry.type === 'tv_show' || entry.format === 'series'
  }
  return entry.type === tab
}

// Short index-style labels (MOVIES, TV) rather than the search tabs' full ones
const INDEX_TABS: { value: 'all' | Tab; label: string }[] = [
  { value: 'all',     label: 'All' },
  { value: 'movie',   label: 'Movies' },
  { value: 'tv_show', label: 'TV' },
  { value: 'kdrama',  label: 'Kdrama' },
  { value: 'anime',   label: 'Anime' },
  { value: 'book',    label: 'Books' },
  { value: 'manga',   label: 'Manga' },
  { value: 'manhwa',  label: 'Manhwa' },
]

const SELECT_STYLE = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text)',
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  completed:     { bg: '#D4AF6A', text: '#080808' },
  in_progress:   { bg: '#4CAF82', text: '#080808' },
  plan_to_watch: { bg: '#C0392B', text: '#F2EFE9' },
  on_hold:       { bg: '#B58DB6', text: '#080808' },
  dropped:       { bg: '#6B6660', text: '#F2EFE9' },
}

// Muted/desaturated per-type wayfinding colors — deliberately distinct from the status palette above
const TYPE_DOT_COLORS: Record<string, string> = {
  movie:   '#6E8FA3',
  tv_show: '#5FA3A0',
  kdrama:  '#C48793',
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

// Shown when a tab has no entries at all (before status/genre filtering) —
// filtered-to-empty keeps the generic "No entries match these filters." message.
const EMPTY_MESSAGES: Record<'all' | Tab, string> = {
  all:     'Your vault is empty. Add your first entry.',
  movie:   'No movies in your vault yet.',
  tv_show: 'No TV shows in your vault yet.',
  kdrama:  'No kdramas in your vault yet.',
  anime:   'No anime in your vault yet.',
  book:    'Your bookshelf is empty.',
  manga:   'No manga in your vault yet.',
  manhwa:  'No manhwa in your vault yet.',
}

function EmptyState({ tab }: { tab: 'all' | Tab }) {
  return (
    <div className="flex items-center justify-center px-6" style={{ minHeight: '45vh' }}>
      {/* soft dark scrim so the muted text stays readable over bright aurora bands */}
      <div
        className="flex items-center gap-2.5 rounded-lg px-5 py-3"
        style={{ background: 'rgba(8,8,8,0.5)' }}
      >
        {tab !== 'all' && (
          <span
            aria-hidden="true"
            className="rounded-full flex-shrink-0"
            style={{ width: 9, height: 9, background: TYPE_DOT_COLORS[tab] }}
          />
        )}
        <p
          className="text-sm text-center"
          style={{ color: 'var(--color-text-muted)', textShadow: '0 1px 8px rgba(8,8,8,0.8)' }}
        >
          {EMPTY_MESSAGES[tab]}
        </p>
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
const CARD_STAGGER_STEP_MS = 40
const CARD_STAGGER_CAP_MS = 500

function EntryCard({ entry, index, onClick, selectionMode, selected, onToggleSelect, onQuickStatus }: {
  entry: EditableEntry
  index: number
  onClick: () => void
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
  onQuickStatus?: (next: string) => void
}) {
  const [imgError, setImgError] = useState(false)
  const [entered, setEntered] = useState(false)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const showFallback = !entry.poster_url || imgError
  const progress = progressPercent(entry)

  function handleActivate() {
    if (selectionMode) onToggleSelect?.()
    else onClick()
  }

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      className={`w-full ${entered ? 'card-visible' : 'card-entering'}`}
      style={{ transitionDelay: `${Math.min(index * CARD_STAGGER_STEP_MS, CARD_STAGGER_CAP_MS)}ms` }}
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
        boxShadow: '0 0 20px 3px rgba(212,175,106,0.35)',
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
        boxShadow: '0 0 0px 0px rgba(212,175,106,0)',
        opacity: selectionMode && !selected ? 0.7 : 1,
        transition: 'opacity 0.2s ease',
      }}
    >
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '2/3' }}>
        {!showFallback ? (
          <img
            src={sharpPoster(entry.poster_url)!}
            alt={entry.title}
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
              border: '2px solid var(--color-gold)',
              background: selected ? 'var(--color-gold)' : 'rgba(8,8,8,0.55)',
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
              style={{ width: `${progress}%`, background: '#D4AF6A' }}
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
              style={{ color: 'rgba(212,175,106,0.8)' }}
            >
              <span aria-hidden="true" style={{ fontSize: 10 }}>★</span>
              {entry.rating}
            </span>
          )}
        </div>
        <span
          className="text-xs rounded-full px-2 py-0.5 self-start font-medium"
          style={{
            background: (STATUS_STYLES[entry.status] ?? STATUS_STYLES.dropped).bg,
            color: (STATUS_STYLES[entry.status] ?? STATUS_STYLES.dropped).text,
          }}
        >
          {statusLabel(entry.status, entry.type)}
        </span>
      </div>
    </motion.div>
    </div>
  )
}

// Two line segments with a 12px gap around the diamond — reads as one rule
// that breaks around the ornament, without needing a background patch to mask
// the line (a solid patch would show against the aurora).
function OrnamentDivider() {
  return (
    <div className="flex items-center px-6" style={{ margin: '20px 0', gap: 12 }} aria-hidden="true">
      <span className="flex-1" style={{ height: 1, background: 'var(--color-border)' }} />
      <span style={{ color: 'var(--color-gold)', fontSize: 8, lineHeight: 1 }}>◆</span>
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
    <div className="pt-6 pb-2">
      <h2 className="text-sm font-semibold px-6 mb-3" style={{ color: 'var(--color-text)' }}>
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
  typeFilter: 'all' | Tab
  onTypeFilterChange: (tab: 'all' | Tab) => void
  // Entries state lives in App so the vault header can show live counts;
  // this component still owns fetching and all mutations via the setter.
  entries: EditableEntry[]
  setEntries: Dispatch<SetStateAction<EditableEntry[]>>
}

export default function EntryList({ userId, refreshKey, typeFilter, onTypeFilterChange, entries, setEntries }: Props) {
  const [loading, setLoading]         = useState(true)
  const [editing, setEditing]         = useState<EditableEntry | null>(null)
  const [statusFilter, setStatusFilter]= useState('')
  const [genreFilter,  setGenreFilter] = useState('')
  const [sortBy,       setSortBy]      = useState('newest')
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
      .then(({ data }) => {
        // Guard against a stale request (e.g. rapid refreshKey changes) resolving
        // after a newer one and flipping loading back off with outdated data.
        if (cancelled) return
        setEntries(data ?? [])
        setLoading(false)
      })
    return () => { cancelled = true }
    // setEntries is a useState setter from App, so it's referentially stable —
    // including it satisfies exhaustive-deps without ever re-running the effect
  }, [userId, refreshKey, setEntries])

  const genres = useMemo(() => {
    const set = new Set<string>()
    entries.forEach(e => {
      e.genres?.forEach(g => set.add(g))
    })
    return [...set].sort()
  }, [entries])

  // Entries for the current tab before status/genre filtering — used to tell
  // "this tab is truly empty" (per-tab empty state) apart from "filters
  // excluded everything" (generic message).
  const tabEntries = useMemo(
    () => entries.filter(e => matchesTypeTab(e, typeFilter)),
    [entries, typeFilter]
  )

  const visible = useMemo(() => {
    let result = tabEntries
    if (statusFilter) result = result.filter(e => e.status === statusFilter)
    if (genreFilter)  result = result.filter(e => e.genres?.includes(genreFilter) ?? false)
    if (sortBy === 'year_desc') {
      result = [...result].sort((a, b) => {
        if (!a.year && !b.year) return 0
        if (!a.year) return 1
        if (!b.year) return -1
        return Number(b.year) - Number(a.year)
      })
    } else if (sortBy === 'year_asc') {
      result = [...result].sort((a, b) => {
        if (!a.year && !b.year) return 0
        if (!a.year) return 1
        if (!b.year) return -1
        return Number(a.year) - Number(b.year)
      })
    } else if (sortBy === 'title_az') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title))
    }
    return result
  }, [tabEntries, statusFilter, genreFilter, sortBy])

  const inProgress = useMemo(
    () => tabEntries.filter(e => e.status === 'in_progress'),
    [tabEntries]
  )

  function handleSaved(updated: Pick<EditableEntry, 'id' | 'status' | 'rating' | 'metadata'>) {
    setEntries(prev =>
      prev.map(e => e.id === updated.id ? { ...e, ...updated } : e)
    )
  }

  async function quickSetStatus(entry: EditableEntry, next: string) {
    const { error } = await supabase
      .from('entries')
      .update({ status: next })
      .eq('id', entry.id)

    if (error) {
      toast.error(error.message, { style: { border: '1px solid var(--color-danger)' } })
      return
    }

    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: next } : e))
    if (next === 'completed') {
      toast.success(`Marked ${entry.title} as Completed`, {
        icon: <span style={{ color: 'var(--color-gold)', fontWeight: 700 }}>✓</span>,
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

  if (loading) {
    return (
      <>
        <SkeletonShelf />
        <div
          className="grid gap-6 px-6 pt-6 pb-10"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
        >
          {Array.from({ length: 10 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      </>
    )
  }

  return (
    <>
      {/* Single toolbar line: index tabs left, filter controls right (they wrap
          below on narrow viewports). Rendered even when the current tab is
          empty — the tabs are the way to switch back out. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 pt-4 pb-2">
        <div className="flex gap-4 flex-wrap items-center">
          {INDEX_TABS.map(t => {
            const active = typeFilter === t.value
            const count = entries.filter(e => matchesTypeTab(e, t.value)).length
            return (
              <button
                key={t.value}
                onClick={() => onTypeFilterChange(t.value)}
                className={`text-xs font-medium uppercase whitespace-nowrap cursor-pointer transition-colors ${
                  active ? 'text-[#D4AF6A]' : 'text-[#9A9590] hover:text-[#F2EFE9]'
                }`}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px 0 6px',
                  letterSpacing: '0.08em',
                  borderBottom: active ? '2px solid #D4AF6A' : '2px solid transparent',
                  // keeps the labels legible over bright aurora bands
                  textShadow: '0 1px 6px rgba(8, 8, 8, 0.9)',
                }}
              >
                {t.label}
                {/* count in a slightly more muted shade than its label */}
                <span
                  style={{
                    marginLeft: 5,
                    color: active ? 'rgba(212,175,106,0.75)' : '#52504B',
                  }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-2 items-center ml-auto">
          <Dropdown
            ariaLabel="Filter by status"
            options={[{ value: '', label: 'All Statuses' }, ...STATUS_FILTER_OPTIONS]}
            value={statusFilter}
            onChange={setStatusFilter}
          />

          {genres.length > 0 && (
            <Dropdown
              ariaLabel="Filter by genre"
              options={[{ value: '', label: 'All Genres' }, ...genres.map(g => ({ value: g, label: g }))]}
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
                className="rounded px-2.5 py-1.5 text-xs cursor-pointer hover:opacity-80 disabled:opacity-50"
                style={SELECT_STYLE}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="rounded px-2.5 py-1.5 text-xs font-semibold cursor-pointer hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--color-danger)', color: '#F2EFE9', border: 'none' }}
              >
                {bulkDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </>
          ) : selectionMode ? (
            <>
              <span
                className="rounded px-2.5 py-1.5 text-xs"
                style={{ ...SELECT_STYLE, color: 'var(--color-text-muted)' }}
              >
                {selectedIds.size} selected
              </span>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setConfirmingBulkDelete(true)}
                  className="rounded px-2.5 py-1.5 text-xs font-semibold cursor-pointer hover:opacity-90"
                  style={{ background: 'var(--color-danger)', color: '#F2EFE9', border: 'none' }}
                >
                  Delete
                </button>
              )}
              <button
                onClick={exitSelectionMode}
                className="rounded px-2.5 py-1.5 text-xs cursor-pointer hover:opacity-80"
                style={SELECT_STYLE}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setSelectionMode(true)}
              className="rounded px-2.5 py-1.5 text-xs cursor-pointer hover:opacity-80"
              style={SELECT_STYLE}
            >
              Select
            </button>
          )}

          <Dropdown
            ariaLabel="Sort by"
            options={SORT_OPTIONS}
            value={sortBy}
            onChange={setSortBy}
          />
          </div>
        </div>
      </div>

      {bulkDeleteError && (
        <p className="text-xs px-6 pb-2" style={{ color: 'var(--color-danger)' }}>{bulkDeleteError}</p>
      )}

      <OrnamentDivider />

      {tabEntries.length === 0 && <EmptyState tab={typeFilter} />}

      {tabEntries.length > 0 && inProgress.length > 0 && (
        <div className="pb-2">
          <h2 className="text-sm font-semibold px-6 mb-3" style={{ color: 'var(--color-text)' }}>
            Continue
          </h2>
          <div className="flex gap-4 overflow-x-auto px-6 pb-2">
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

      {tabEntries.length > 0 && (visible.length === 0 ? (
        <p className="text-center text-sm mt-8" style={{ color: 'var(--color-text-muted)' }}>
          No entries match these filters.
        </p>
      ) : (
        <div
          className="grid gap-6 px-6 pb-10"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
        >
          <AnimatePresence mode="popLayout">
          {visible.map((entry, i) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              index={i}
              onClick={() => setEditing(entry)}
              selectionMode={selectionMode}
              selected={selectedIds.has(entry.id)}
              onToggleSelect={() => toggleSelect(entry.id)}
              onQuickStatus={next => quickSetStatus(entry, next)}
            />
          ))}
          </AnimatePresence>
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
