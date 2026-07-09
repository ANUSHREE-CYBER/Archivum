import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useModalFocus } from '../lib/useModalFocus'

const TYPE_OPTIONS = [
  { value: 'movie',   label: 'Movie' },
  { value: 'tv_show', label: 'TV Show' },
  { value: 'kdrama',  label: 'Kdrama' },
  { value: 'anime',   label: 'Anime' },
  { value: 'book',    label: 'Book' },
  { value: 'manga',   label: 'Manga' },
  { value: 'manhwa',  label: 'Manhwa' },
]

// Mirrors the format column: cross-category classification so e.g. a manually
// added anime film can surface under the Movie tab like API-sourced ones do.
const FORMAT_OPTIONS = [
  { value: '',       label: '—' },
  { value: 'movie',  label: 'Movie' },
  { value: 'series', label: 'Series' },
  { value: 'comic',  label: 'Comic' },
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
  const [format,      setFormat]      = useState('')
  const [author,      setAuthor]      = useState('')
  const [year,        setYear]        = useState('')
  const [posterUrl,   setPosterUrl]   = useState('')
  const [genresInput, setGenresInput] = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const backdropRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const headingId = useId()
  useModalFocus(panelRef)

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
    const authorTrimmed = author.trim()

    const { error: err } = await supabase.from('entries').insert({
      user_id:    userId,
      title:      title.trim(),
      type,
      format:     format || null,
      year:       year || null,
      poster_url: posterUrl.trim() || null,
      genres:     genresList && genresList.length > 0 ? genresList : null,
      status:     'plan_to_watch',
      source_api: 'manual',
      source_id:  null,
      ...(type === 'book' && authorTrimmed ? { metadata: { author: authorTrimmed } } : {}),
    })

    setSaving(false)
    if (err) {
      setError(err.message)
      toast.error(err.message, { style: { border: '1px solid var(--color-danger)' } })
    } else {
      toast.success(`Added ${title.trim()} to your library`)
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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="flex flex-col gap-4 rounded-lg w-full max-w-sm p-6"
        style={{
          background: 'var(--color-background)',
          border: '1px solid var(--color-border)',
        }}
      >
        <h2 id={headingId} className="font-semibold" style={{ color: 'var(--color-text)' }}>
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
            onChange={e => {
              setType(e.target.value)
              // A format picked for the previous type (e.g. Comic for a manga)
              // rarely makes sense for the next one — start over.
              setFormat('')
            }}
            className="rounded px-3 py-2 outline-none text-sm"
            style={INPUT_STYLE}
          >
            {TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {type !== 'book' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Format{' '}
              <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}>
                (optional — cross-lists into Movies / TV)
              </span>
            </label>
            <select
              value={format}
              onChange={e => setFormat(e.target.value)}
              className="rounded px-3 py-2 outline-none text-sm"
              style={INPUT_STYLE}
            >
              {FORMAT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        {type === 'book' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Author
            </label>
            <input
              type="text"
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="e.g. Ursula K. Le Guin"
              className="rounded px-3 py-2 outline-none text-sm"
              style={INPUT_STYLE}
            />
          </div>
        )}

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
