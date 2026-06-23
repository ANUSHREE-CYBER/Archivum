import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Entry {
  id: string
  title: string
  year: string | null
  poster_url: string | null
  status: string
}

const STATUS_LABELS: Record<string, string> = {
  plan_to_watch: 'Plan to Watch',
  watching: 'Watching',
  completed: 'Completed',
  dropped: 'Dropped',
}

interface Props {
  userId: string
  refreshKey: number
}

export default function EntryList({ userId, refreshKey }: Props) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    supabase
      .from('entries')
      .select('id, title, year, poster_url, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setEntries(data ?? [])
        setLoading(false)
      })
  }, [userId, refreshKey])

  if (loading) return null

  if (entries.length === 0) {
    return (
      <p
        className="text-center text-sm mt-8"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Nothing added yet.
      </p>
    )
  }

  return (
    <div
      className="grid gap-4 px-6 pb-10"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
    >
      {entries.map(entry => (
        <div key={entry.id} className="flex flex-col gap-2">
          {entry.poster_url ? (
            <img
              src={entry.poster_url}
              alt={entry.title}
              className="w-full rounded object-cover"
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
              {STATUS_LABELS[entry.status] ?? entry.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
