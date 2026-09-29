import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useModalFocus } from '../lib/useModalFocus'
import { useTilt } from '../lib/useTilt'
import { TYPE_DOT_COLORS } from '../lib/typeColors'
import CoverFallback from './CoverFallback'

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
// 'comic' is deliberately not offered: it's the only sensible value for the
// two comic types and nothing else can hold it, so it's applied on save rather
// than asked for (see COMIC_TYPES below).
const FORMAT_OPTIONS = [
  { value: '',       label: '—' },
  { value: 'movie',  label: 'Movie' },
  { value: 'series', label: 'Series' },
]

// Manga and manhwa have no format choice to make — a comic is always a comic,
// and Movie/Series are meaningless for them (worse, they used to be selectable,
// which is how a manga could end up cross-listed into TV Show). The selector is
// hidden for these and 'comic' is written on save, matching what MediaSearch
// already stores for imported manga.
const COMIC_TYPES = new Set(['manga', 'manhwa'])

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
  // Cleared on every edit of the URL, so fixing a typo'd URL retries the image
  const [previewError, setPreviewError] = useState(false)
  const { tiltRef, glareRef, onMouseMove, onMouseLeave } = useTilt({ max: 7, lift: 'translateZ(20px)', perspective: 900, glare: 0.28 })
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
      format:     COMIC_TYPES.has(type) ? 'comic' : (format || null),
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
      toast.success(`${title.trim()} added to your archive`)
      onSaved()
      onClose()
    }
  }

  const showFormat = type !== 'book' && !COMIC_TYPES.has(type)
  const formatIndex = Math.max(0, FORMAT_OPTIONS.findIndex(o => o.value === format))
  const previewUrl = posterUrl.trim()

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === backdropRef.current) onClose() }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="glass-modal manual-modal"
      >
        <div className="manual-modal-form">
          <h2 id={headingId} className="manual-modal-title">Add manually</h2>

          <label className="modal-field">
            <span>Title <span style={{ color: 'var(--color-danger)' }}>*</span></span>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Rebecca"
              className="vault-input modal-input"
            />
          </label>

          {/* Type — chips instead of a native <select> */}
          <span className="modal-field-label" id={`${headingId}-type`}>Type</span>
          <div className="manual-type-chips" role="radiogroup" aria-labelledby={`${headingId}-type`}>
            {TYPE_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={type === o.value}
                onClick={() => {
                  setType(o.value)
                  // A format picked for the previous type rarely makes sense
                  // for the next one — start over.
                  setFormat('')
                }}
                className={`type-chip cursor-pointer${type === o.value ? ' is-on' : ''}`}
              >
                <span className="type-chip-dot" style={{ background: TYPE_DOT_COLORS[o.value] }} />
                {o.label}
              </button>
            ))}
          </div>

          {showFormat && (
            <>
              <span className="modal-field-label" id={`${headingId}-format`}>
                Format <span style={{ color: '#6B6660' }}>(optional — cross-lists into Movies / TV)</span>
              </span>
              {/* Segmented control: one rose pill slides under the three
                  72px segments (left = 3 + index · 72) */}
              <div className="format-switch" role="radiogroup" aria-labelledby={`${headingId}-format`}>
                <span
                  aria-hidden="true"
                  className="format-switch-indicator"
                  style={{ left: 3 + formatIndex * 72 }}
                />
                {FORMAT_OPTIONS.map(o => (
                  <button
                    key={o.value || 'none'}
                    type="button"
                    role="radio"
                    aria-checked={format === o.value}
                    aria-label={o.value ? o.label : 'No format'}
                    onClick={() => setFormat(o.value)}
                    className={`format-switch-btn cursor-pointer${format === o.value ? ' is-on' : ''}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {type === 'book' && (
            <label className="modal-field">
              Author
              <input
                type="text"
                value={author}
                onChange={e => setAuthor(e.target.value)}
                placeholder="e.g. Ursula K. Le Guin"
                className="vault-input modal-input"
              />
            </label>
          )}

          <div className="manual-modal-pair">
            <label className="modal-field">
              Year
              <input
                type="number"
                value={year}
                onChange={e => setYear(e.target.value)}
                placeholder="2023"
                className="vault-input modal-input"
              />
            </label>
            <label className="modal-field">
              Poster URL
              <input
                type="url"
                value={posterUrl}
                onChange={e => {
                  setPosterUrl(e.target.value)
                  setPreviewError(false)
                }}
                placeholder="https://…"
                className="vault-input modal-input"
              />
            </label>
          </div>

          <label className="modal-field">
            <span>Genres <span style={{ color: '#6B6660' }}>(comma-separated)</span></span>
            <input
              type="text"
              value={genresInput}
              onChange={e => setGenresInput(e.target.value)}
              placeholder="Drama, Romance"
              className="vault-input modal-input"
            />
          </label>

          {error && (
            <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>
          )}

          <div className="flex gap-2 justify-end" style={{ marginTop: 4 }}>
            <button type="button" onClick={onClose} className="modal-btn cursor-pointer">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="modal-btn is-primary cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Live preview: the card as it will look, updating as you type */}
        <div className="manual-modal-preview" aria-hidden="true">
          <div
            ref={tiltRef}
            className="manual-preview-card"
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
          >
            {previewUrl && !previewError ? (
              <img src={previewUrl} alt="" onError={() => setPreviewError(true)} />
            ) : (
              <CoverFallback type={type} title={title.trim() || 'Untitled'} year={year || null} />
            )}
            <span className="manual-preview-dot" style={{ background: TYPE_DOT_COLORS[type] }} />
            <div ref={glareRef} className="card-glare" />
          </div>
          <span className="manual-preview-label">Live preview</span>
        </div>
        {/* Close. Last in the DOM on purpose: useModalFocus focuses the
            first control on open, and that should stay the form, not this. */}
        <button type="button" onClick={onClose} className="modal-close cursor-pointer" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
