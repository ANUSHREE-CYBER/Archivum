import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import EntryEditModal, { STATUS_OPTIONS, statusLabel } from './EntryEditModal'
import type { EditableEntry } from './EntryEditModal'

const TYPE_OPTIONS = [
  { value: 'movie',   label: 'Movie' },
  { value: 'tv_show', label: 'TV Show' },
  { value: 'kdrama',  label: 'Kdrama' },
  { value: 'anime',   label: 'Anime' },
  { value: 'book',    label: 'Book' },
  { value: 'manga',   label: 'Manga' },
  { value: 'manhwa',  label: 'Manhwa' },
]

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

interface Props {
  userId: string
  refreshKey: number
}

export default function EntryList({ userId, refreshKey }: Props) {
  const [entries, setEntries]         = useState<EditableEntry[]>([])
  const [loading, setLoading]         = useState(true)
  const [editing, setEditing]         = useState<EditableEntry | null>(null)
  const [typeFilter,   setTypeFilter]  = useState('')
  const [statusFilter, setStatusFilter]= useState('')
  const [genreFilter,  setGenreFilter] = useState('')
  const [sortBy,       setSortBy]      = useState('newest')

  useEffect(() => {
    setLoading(true)
    supabase
      .from('entries')
      .select('id, title, year, poster_url, status, rating, type, metadata, genres')
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
    if (typeFilter)   result = result.filter(e => e.type   === typeFilter)
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
      {/* filter + sort bar */}
      <div className="flex flex-wrap gap-2 px-6 pb-4">
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="rounded px-2 py-1.5 text-xs outline-none cursor-pointer"
          style={SELECT_STYLE}
        >
          <option value="">All Types</option>
          {TYPE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

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
            <motion.button
              key={entry.id}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
              whileHover={{ scale: 1.03, y: -3, transition: { duration: 0.2, ease: 'easeOut' } }}
              onClick={() => setEditing(entry)}
              className="group flex flex-col gap-2 text-left cursor-pointer"
              style={{ background: 'none', border: 'none', padding: 0, transformOrigin: 'bottom center' }}
            >
              {entry.poster_url ? (
                <img
                  src={sharpPoster(entry.poster_url)!}
                  alt={entry.title}
                  className="w-full rounded object-cover transition-[filter] duration-300 group-hover:brightness-110"
                  style={{ aspectRatio: '2/3' }}
                />
              ) : (
                <div
                  className="w-full rounded"
                  style={{ aspectRatio: '2/3', background: 'var(--color-surface)' }}
                />
              )}
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
                  className="text-xs rounded px-1.5 py-0.5 self-start"
                  style={{
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-muted)',
                    border: '1px solid var(--color-border)',
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
