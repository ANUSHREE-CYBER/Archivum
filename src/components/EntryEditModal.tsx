import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export const STATUS_OPTIONS = [
  { value: 'plan_to_watch', label: 'Plan to Watch' },
  { value: 'in_progress',   label: 'Watching' },
  { value: 'completed',     label: 'Completed' },
  { value: 'dropped',       label: 'Dropped' },
  { value: 'on_hold',       label: 'On Hold' },
] as const

export type StatusValue = typeof STATUS_OPTIONS[number]['value']

const READ_TYPES = new Set(['book', 'manga', 'manhwa'])

export function statusLabel(status: string, type: string): string {
  if (READ_TYPES.has(type)) {
    if (status === 'plan_to_watch') return 'Plan to Read'
    if (status === 'in_progress')   return 'Reading'
  }
  return STATUS_OPTIONS.find(o => o.value === status)?.label ?? status
}

export interface EditableEntry {
  id: string
  title: string
  year: string | null
  poster_url: string | null
  status: string
  rating: number | null
  type: string
  metadata: Record<string, unknown> | null
}

interface Props {
  entry: EditableEntry
  onClose: () => void
  onSaved: (updated: Pick<EditableEntry, 'id' | 'status' | 'rating' | 'metadata'>) => void
}

function NumField({ label, value, onChange }: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </label>
      <input
        type="number"
        min={0}
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="rounded px-3 py-2 outline-none text-sm"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text)',
        }}
      />
    </div>
  )
}

export default function EntryEditModal({ entry, onClose, onSaved }: Props) {
  const meta = (entry.metadata ?? {}) as Record<string, unknown>

  const [status, setStatus]           = useState<string>(entry.status)
  const [rating, setRating]           = useState<number | null>(entry.rating)
  const [season, setSeason]           = useState<number | null>(typeof meta.season      === 'number' ? meta.season      : null)
  const [episode, setEpisode]         = useState<number | null>(typeof meta.episode     === 'number' ? meta.episode     : null)
  const [currentPage, setCurrentPage] = useState<number | null>(typeof meta.currentPage === 'number' ? meta.currentPage : null)
  const [totalPages, setTotalPages]   = useState<number | null>(typeof meta.totalPages  === 'number' ? meta.totalPages  : null)
  const [volume, setVolume]           = useState<number | null>(typeof meta.volume      === 'number' ? meta.volume      : null)
  const [chapter, setChapter]         = useState<number | null>(typeof meta.chapter     === 'number' ? meta.chapter     : null)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const backdropRef = useRef<HTMLDivElement>(null)

  const { type } = entry
  const isSerial = type === 'tv_show' || type === 'kdrama' || type === 'anime'
  const isBook   = type === 'book'
  const isPrint  = type === 'manga'  || type === 'manhwa'
  const author   = typeof meta.author === 'string' ? meta.author : null

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setError('')

    let progressMeta: Record<string, unknown> = {}
    if (isSerial) progressMeta = { season, episode }
    else if (isBook)  progressMeta = { currentPage, totalPages }
    else if (isPrint) progressMeta = { volume, chapter }

    // Strip nulls so we never overwrite an existing value with null
    const cleanProgress = Object.fromEntries(
      Object.entries(progressMeta).filter(([, v]) => v !== null)
    )
    const updatedMetadata = { ...meta, ...cleanProgress }

    const { error: err } = await supabase
      .from('entries')
      .update({ status, rating, metadata: updatedMetadata })
      .eq('id', entry.id)

    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      onSaved({ id: entry.id, status, rating, metadata: updatedMetadata })
      onClose()
    }
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => { if (e.target === backdropRef.current) onClose() }}
    >
      <div
        className="flex flex-col gap-5 rounded-lg w-full max-w-sm p-6"
        style={{
          background: 'var(--color-background)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* header */}
        <div className="flex gap-4 items-start">
          {entry.poster_url ? (
            <img
              src={entry.poster_url}
              alt={entry.title}
              className="w-14 rounded object-cover flex-shrink-0"
              style={{ aspectRatio: '2/3' }}
            />
          ) : (
            <div
              className="w-14 rounded flex-shrink-0"
              style={{ aspectRatio: '2/3', background: 'var(--color-surface)' }}
            />
          )}
          <div className="flex flex-col gap-1 pt-1">
            <span className="font-semibold leading-tight" style={{ color: 'var(--color-text)' }}>
              {entry.title}
            </span>
            {entry.year && (
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {entry.year}
              </span>
            )}
            {author && (
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {author}
              </span>
            )}
          </div>
        </div>

        {/* status */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
            Status
          </label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="rounded px-3 py-2 outline-none text-sm"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{statusLabel(opt.value, entry.type)}</option>
            ))}
          </select>
        </div>

        {/* rating */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
            Rating
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => setRating(rating === n ? null : n)}
                className="w-8 h-8 rounded text-sm font-medium cursor-pointer"
                style={{
                  background: rating === n ? 'var(--color-gold)' : 'var(--color-surface)',
                  color: rating === n ? 'var(--color-background)' : 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* progress fields */}
        {isSerial && (
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Current Season"  value={season}  onChange={setSeason} />
            <NumField label="Current Episode" value={episode} onChange={setEpisode} />
          </div>
        )}
        {isBook && (
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Current Page" value={currentPage} onChange={setCurrentPage} />
            <NumField label="Total Pages"  value={totalPages}  onChange={setTotalPages} />
          </div>
        )}
        {isPrint && (
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Current Volume"  value={volume}  onChange={setVolume} />
            <NumField label="Current Chapter" value={chapter} onChange={setChapter} />
          </div>
        )}

        {error && (
          <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>
        )}

        {/* actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded text-sm cursor-pointer hover:opacity-80"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded text-sm font-semibold cursor-pointer hover:opacity-90 disabled:opacity-50"
            style={{
              background: 'var(--color-gold)',
              color: 'var(--color-background)',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
