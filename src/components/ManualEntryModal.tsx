import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const TYPE_OPTIONS = [
  { value: 'movie',   label: 'Movie' },
  { value: 'tv_show', label: 'TV Show' },
  { value: 'kdrama',  label: 'Kdrama' },
  { value: 'anime',   label: 'Anime' },
  { value: 'book',    label: 'Book' },
  { value: 'manga',   label: 'Manga' },
  { value: 'manhwa',  label: 'Manhwa' },
]

const INPUT_STYLE = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text)',
}

interface Props {
  userId: string
  onClose: () => void
  onSaved: () => void
}

export default function ManualEntryModal({ userId, onClose, onSaved }: Props) {
  const [title,       setTitle]       = useState('')
  const [type,        setType]        = useState('movie')
  const [year,        setYear]        = useState('')
  const [posterUrl,   setPosterUrl]   = useState('')
  const [genresInput, setGenresInput] = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSave() {
    if (!title.trim()) { setError('Title is required.'); return }
    if (saving) return
    setSaving(true)
    setError('')

    const genresList = genresInput
      ? genresInput.split(',').map(g => g.trim()).filter(Boolean)
      : null

    const { error: err } = await supabase.from('entries').insert({
      user_id:    userId,
      title:      title.trim(),
      type,
      format:     null,
      year:       year || null,
      poster_url: posterUrl.trim() || null,
      genres:     genresList && genresList.length > 0 ? genresList : null,
      status:     'plan_to_watch',
      source_api: 'manual',
      source_id:  null,
    })

    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      onSaved()
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
        className="flex flex-col gap-4 rounded-lg w-full max-w-sm p-6"
        style={{
          background: 'var(--color-background)',
          border: '1px solid var(--color-border)',
        }}
      >
        <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>
          Add manually
        </h2>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
            Title <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="rounded px-3 py-2 outline-none text-sm"
            style={INPUT_STYLE}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
            Type
          </label>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="rounded px-3 py-2 outline-none text-sm"
            style={INPUT_STYLE}
          >
            {TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
            Year
          </label>
          <input
            type="number"
            value={year}
            onChange={e => setYear(e.target.value)}
            placeholder="e.g. 2023"
            className="rounded px-3 py-2 outline-none text-sm"
            style={INPUT_STYLE}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
            Poster URL
          </label>
          <input
            type="url"
            value={posterUrl}
            onChange={e => setPosterUrl(e.target.value)}
            placeholder="https://…"
            className="rounded px-3 py-2 outline-none text-sm"
            style={INPUT_STYLE}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
            Genres{' '}
            <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}>
              (comma-separated)
            </span>
          </label>
          <input
            type="text"
            value={genresInput}
            onChange={e => setGenresInput(e.target.value)}
            placeholder="e.g. Drama, Romance"
            className="rounded px-3 py-2 outline-none text-sm"
            style={INPUT_STYLE}
          />
        </div>

        {error && (
          <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>
        )}

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
