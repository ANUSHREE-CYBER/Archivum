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
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: Math.min(i * 0.035, 0.35),
      duration: 0.32,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
}

function EntryCard({ entry, index, onClick }: { entry: EditableEntry; index: number; onClick: () => void }) {
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
      onClick={onClick}
      className="group flex flex-col gap-2 text-left cursor-pointer w-full"
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        borderRadius: 6,
        boxShadow: '0 0 0px 0px rgba(212,175,106,0)',
        transformOrigin: 'bottom center',
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
    let result = entries
    if (typeFilter !== 'all') result = result.filter(e => e.type === typeFilter)
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

  const inProgress = useMemo(() => entries.filter(e => e.status === 'in_progress'), [entries])

  function handleSaved(updated: Pick<EditableEntry, 'id' | 'status' | 'rating' | 'metadata'>) {
    setEntries(prev =>
      prev.map(e => e.id === updated.id ? { ...e, ...updated } : e)
    )
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
      <div className="flex flex-wrap gap-2 px-6 pb-4">
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

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="rounded px-2 py-1.5 text-xs outline-none cursor-pointer ml-auto"
          style={SELECT_STYLE}
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

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
            <EntryCard key={entry.id} entry={entry} index={i} onClick={() => setEditing(entry)} />
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
        />
      )}
    </>
  )
}
