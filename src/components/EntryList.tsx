import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import EntryEditModal, { STATUS_OPTIONS, statusLabel } from './EntryEditModal'
import type { EditableEntry } from './EntryEditModal'
import type { Tab } from './MediaSearch'

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

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: Math.min(i * 0.05, 0.5),
      duration: 0.3,
      ease: 'easeOut',
    },
  }),
}

function EntryCard({ entry, index, onClick, selectionMode, selected, onToggleSelect }: {
  entry: EditableEntry
  index: number
  onClick: () => void
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const showFallback = !entry.poster_url || imgError

  return (
    <motion.button
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      whileHover={{
        scale: 1.04,
        y: -3,
        boxShadow: '0 0 20px 3px rgba(212,175,106,0.35)',
        transition: { duration: 0.25, ease: 'easeOut' },
      }}
      onClick={() => (selectionMode ? onToggleSelect?.() : onClick())}
      className="group flex flex-col gap-2 text-left cursor-pointer w-full"
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        borderRadius: 6,
        boxShadow: '0 0 0px 0px rgba(212,175,106,0)',
        opacity: selectionMode && !selected ? 0.7 : 1,
        transformOrigin: 'bottom center',
        transition: 'opacity 0.2s ease',
      }}
    >
      <div className="relative w-full overflow-hidden rounded" style={{ aspectRatio: '2/3' }}>
        {!showFallback ? (
          <img
            src={sharpPoster(entry.poster_url)!}
            alt={entry.title}
            onError={() => setImgError(true)}
            className="w-full h-full rounded object-cover transition-[filter] duration-300 group-hover:brightness-110"
          />
        ) : (
          <div
            className="w-full h-full rounded flex items-center justify-center p-3 text-center"
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
      </div>
      <div className="flex flex-col gap-1">
        <span
          className="text-sm font-medium leading-tight line-clamp-2"
          style={{ color: 'var(--color-text)' }}
        >
          {entry.title}
        </span>
        {entry.year && (
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {entry.year}
          </span>
        )}
        <span
          className="text-xs rounded-full px-2 py-0.5 self-start font-medium"
          style={{
            background: (STATUS_STYLES[entry.status] ?? STATUS_STYLES.dropped).bg,
            color: (STATUS_STYLES[entry.status] ?? STATUS_STYLES.dropped).text,
          }}
        >
          {statusLabel(entry.status, entry.type)}
        </span>
        {entry.rating !== null && (
          <span className="text-xs font-semibold" style={{ color: 'var(--color-gold)' }}>
            {entry.rating}/10
          </span>
        )}
      </div>
    </motion.button>
  )
}

interface Props {
  userId: string
  refreshKey: number
  typeFilter: 'all' | Tab
}

export default function EntryList({ userId, refreshKey, typeFilter }: Props) {
  const [entries, setEntries]         = useState<EditableEntry[]>([])
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
    setLoading(true)
    supabase
      .from('entries')
      .select('id, title, year, poster_url, status, rating, type, format, metadata, genres')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setEntries(data ?? [])
        setLoading(false)
      })
  }, [userId, refreshKey])

  const genres = useMemo(() => {
    const set = new Set<string>()
    entries.forEach(e => {
      e.genres?.forEach(g => set.add(g))
    })
    return [...set].sort()
  }, [entries])

  const visible = useMemo(() => {
    let result = entries.filter(e => matchesTypeTab(e, typeFilter))
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
  }, [entries, typeFilter, statusFilter, genreFilter, sortBy])

  const inProgress = useMemo(
    () => entries.filter(e => e.status === 'in_progress' && matchesTypeTab(e, typeFilter)),
    [entries, typeFilter]
  )

  function handleSaved(updated: Pick<EditableEntry, 'id' | 'status' | 'rating' | 'metadata'>) {
    setEntries(prev =>
      prev.map(e => e.id === updated.id ? { ...e, ...updated } : e)
    )
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
      return
    }

    const deletedIds = new Set((data ?? []).map(row => row.id as string))
    const failedIds = ids.filter(id => !deletedIds.has(id))

    setEntries(prev => prev.filter(e => !deletedIds.has(e.id)))

    if (failedIds.length > 0) {
      setBulkDeleteError(`Failed to delete ${failedIds.length} ${failedIds.length === 1 ? 'entry' : 'entries'}.`)
      setSelectedIds(new Set(failedIds))
      setConfirmingBulkDelete(false)
    } else {
      exitSelectionMode()
    }
  }

  if (loading) return null

  if (entries.length === 0) {
    return (
      <p className="text-center text-sm mt-8" style={{ color: 'var(--color-text-muted)' }}>
        Nothing added yet.
      </p>
    )
  }

  return (
    <>
      {inProgress.length > 0 && (
        <div className="pt-6 pb-2">
          <h2 className="text-sm font-semibold px-6 mb-3" style={{ color: 'var(--color-text)' }}>
            Continue
          </h2>
          <div className="flex gap-4 overflow-x-auto px-6 pb-2">
            {inProgress.map((entry, i) => (
              <div key={entry.id} style={{ width: 130, flexShrink: 0 }}>
                <EntryCard entry={entry} index={i} onClick={() => setEditing(entry)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* filter + sort bar */}
      <div className="flex flex-wrap gap-2 px-6 pb-2 items-center">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded px-2 py-1.5 text-xs outline-none cursor-pointer"
          style={SELECT_STYLE}
        >
          <option value="">All Statuses</option>
          {STATUS_FILTER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {genres.length > 0 && (
          <select
            value={genreFilter}
            onChange={e => setGenreFilter(e.target.value)}
            className="rounded px-2 py-1.5 text-xs outline-none cursor-pointer"
            style={SELECT_STYLE}
          >
            <option value="">All Genres</option>
            {genres.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        )}

        <div className="flex gap-2 items-center ml-auto">
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

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="rounded px-2 py-1.5 text-xs outline-none cursor-pointer"
            style={SELECT_STYLE}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {bulkDeleteError && (
        <p className="text-xs px-6 pb-2" style={{ color: 'var(--color-danger)' }}>{bulkDeleteError}</p>
      )}

      {visible.length === 0 ? (
        <p className="text-center text-sm mt-8" style={{ color: 'var(--color-text-muted)' }}>
          No entries match these filters.
        </p>
      ) : (
        <div
          className="grid gap-4 px-6 pb-10"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
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
            />
          ))}
          </AnimatePresence>
        </div>
      )}

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
