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

export interface EditableEntry {
  id: string
  title: string
  year: string | null
  poster_url: string | null
  status: string
  rating: number | null
}

interface Props {
  entry: EditableEntry
  onClose: () => void
  onSaved: (updated: Pick<EditableEntry, 'id' | 'status' | 'rating'>) => void
}

export default function EntryEditModal({ entry, onClose, onSaved }: Props) {
  const [status, setStatus] = useState<string>(entry.status)
  const [rating, setRating] = useState<number | null>(entry.rating)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const backdropRef = useRef<HTMLDivElement>(null)

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

    const { error: err } = await supabase
      .from('entries')
      .update({ status, rating })
      .eq('id', entry.id)

    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      onSaved({ id: entry.id, status, rating })
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
              <option key={opt.value} value={opt.value}>{opt.label}</option>
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
