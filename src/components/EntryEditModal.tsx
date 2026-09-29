import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { sharpPoster } from '../lib/utils'
import { useModalFocus } from '../lib/useModalFocus'
import { STATUS_COLORS, STATUS_TEXT_COLORS } from '../lib/statusColors'
import { TYPE_DOT_COLORS, TYPE_LABELS } from '../lib/typeColors'
import CoverFallback from './CoverFallback'

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
  format?: 'movie' | 'series' | 'comic' | null
  metadata: Record<string, unknown> | null
  genres: string[] | null
}

interface Props {
  entry: EditableEntry
  onClose: () => void
  onSaved: (updated: Pick<EditableEntry, 'id' | 'status' | 'rating' | 'metadata'>) => void
  onDeleted: (id: string) => void
}

function NumField({ label, value, onChange }: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <label className="modal-field">
      {label}
      <input
        type="number"
        min={0}
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="vault-input modal-input"
      />
    </label>
  )
}

export default function EntryEditModal({ entry, onClose, onSaved, onDeleted }: Props) {
  const meta = (entry.metadata ?? {}) as Record<string, unknown>

  const [status, setStatus]           = useState<string>(entry.status)
  const [rating, setRating]           = useState<number | null>(entry.rating)
  const [season, setSeason]           = useState<number | null>(typeof meta.season      === 'number' ? meta.season      : null)
  const [episode, setEpisode]         = useState<number | null>(typeof meta.episode     === 'number' ? meta.episode     : null)
  const [currentPage, setCurrentPage] = useState<number | null>(typeof meta.currentPage === 'number' ? meta.currentPage : null)
  const [totalPages, setTotalPages]   = useState<number | null>(typeof meta.totalPages  === 'number' ? meta.totalPages  : null)
  const [volume, setVolume]           = useState<number | null>(typeof meta.volume      === 'number' ? meta.volume      : null)
  const [chapter, setChapter]         = useState<number | null>(typeof meta.chapter     === 'number' ? meta.chapter     : null)
  // Totals for serials and comics, so their progress bars (and the Continue
  // stage's "completes at total") work the way books' already did
  const [totalEpisodes, setTotalEpisodes] = useState<number | null>(typeof meta.totalEpisodes === 'number' ? meta.totalEpisodes : null)
  const [totalChapters, setTotalChapters] = useState<number | null>(typeof meta.totalChapters === 'number' ? meta.totalChapters : null)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [posterError, setPosterError] = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting]                 = useState(false)
  const [deleteError, setDeleteError]           = useState('')
  const backdropRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const ids = useId()
  useModalFocus(panelRef)

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
    if (isSerial) progressMeta = { season, episode, totalEpisodes }
    else if (isBook)  progressMeta = { currentPage, totalPages }
    else if (isPrint) progressMeta = { volume, chapter, totalChapters }

    // Strip nulls so we never overwrite an existing value with null
    const cleanProgress = Object.fromEntries(
      Object.entries(progressMeta).filter(([, v]) => v !== null)
    )
    const updatedMetadata = { ...meta, ...cleanProgress }

    const { data, error: err } = await supabase
      .from('entries')
      .update({ status, rating, metadata: updatedMetadata })
      .eq('id', entry.id)
      .select('id')

    setSaving(false)
    if (err) {
      setError(err.message)
      toast.error(err.message, { style: { border: '1px solid var(--color-danger)' } })
    } else if ((data ?? []).length === 0) {
      // Zero rows matched — the entry was likely deleted elsewhere or blocked
      // by RLS. Leave the modal open with the user's edits intact instead of
      // closing as if the save persisted, since they're actively looking at it.
      setError("Couldn't save — this entry may have been removed. Close and refresh to check.")
      toast.error(`Couldn't save ${entry.title}`, { style: { border: '1px solid var(--color-danger)' } })
    } else {
      if (status !== entry.status) {
        if (status === 'completed') {
          toast.success(`Marked ${entry.title} as Completed`, {
            icon: <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>✓</span>,
          })
        } else {
          toast.success(`Moved ${entry.title} to ${statusLabel(status, entry.type)}`)
        }
      }
      onSaved({ id: entry.id, status, rating, metadata: updatedMetadata })
      onClose()
    }
  }

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    setDeleteError('')

    const { error: err } = await supabase.from('entries').delete().eq('id', entry.id)

    setDeleting(false)
    if (err) {
      setDeleteError(err.message)
      toast.error(err.message, { style: { border: '1px solid var(--color-danger)' } })
    } else {
      toast.success(`Deleted ${entry.title}`)
      onDeleted(entry.id)
      onClose()
    }
  }

  // Progress for the pill row + bar, read from the live form state so +1 and
  // the number fields below stay in step with it
  const progressCurrent = isSerial ? episode : isBook ? currentPage : isPrint ? chapter : null
  const progressTotal   = isSerial ? totalEpisodes : isBook ? totalPages : isPrint ? totalChapters : null
  const progressUnit    = isSerial ? 'Episode' : isBook ? 'Page' : 'Chapter'
  const hasProgress     = isSerial || isBook || isPrint
  const progressPct     = progressCurrent && progressTotal ? Math.min(100, (progressCurrent / progressTotal) * 100) : null

  // +1 on the current episode / page / chapter. Reaching a known total clamps
  // to it and flips the status chip to Completed — the same rule as the
  // Continue stage's +1. Nothing is written until Done.
  function bump() {
    const setCurrent = isSerial ? setEpisode : isBook ? setCurrentPage : setChapter
    let next = (progressCurrent ?? 0) + 1
    if (progressTotal && next >= progressTotal) {
      next = progressTotal
      setStatus('completed')
    }
    setCurrent(next)
  }

  const genres = entry.genres?.slice(0, 3).join(', ')
  const metaLine = [entry.year, genres, author].filter(Boolean).join(' · ')
  const shownRating = hoverRating ?? rating

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
        aria-label={`Edit ${entry.title}`}
        className="glass-modal detail-modal"
      >
        {/* the entry's own poster, blurred into the glass */}
        {entry.poster_url && (
          <div
            aria-hidden="true"
            className="detail-modal-bg"
            style={{ backgroundImage: `url("${entry.poster_url}")` }}
          />
        )}

        <div className="detail-modal-poster">
          <div className="detail-modal-poster-frame">
            {entry.poster_url && !posterError ? (
              <img
                src={sharpPoster(entry.poster_url)!}
                alt={entry.title}
                onError={() => setPosterError(true)}
              />
            ) : (
              <CoverFallback type={type} title={entry.title} year={entry.year} size="lg" />
            )}
          </div>
        </div>

        <div className="detail-modal-body">
          <span className="detail-modal-eyebrow">
            <span className="detail-modal-dot" style={{ background: TYPE_DOT_COLORS[type] ?? '#6B6660' }} />
            {TYPE_LABELS[type] ?? type}
          </span>
          <h2 className="detail-modal-title">{entry.title}</h2>
          {metaLine && <span className="detail-modal-meta">{metaLine}</span>}
          <div className="detail-modal-rule" aria-hidden="true">
            <span /><span className="detail-modal-diamond">◆</span><span />
          </div>

          {/* status — chips, replacing the last native <select> */}
          <span className="detail-modal-label" id={`${ids}-status`}>Status</span>
          <div className="detail-modal-chips" role="radiogroup" aria-labelledby={`${ids}-status`}>
            {STATUS_OPTIONS.map(opt => {
              const on = status === opt.value
              const color = STATUS_COLORS[opt.value]
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setStatus(opt.value)}
                  className={`status-chip cursor-pointer${on ? ' is-on' : ''}`}
                  style={on ? {
                    background: color,
                    borderColor: color,
                    color: STATUS_TEXT_COLORS[opt.value],
                    boxShadow: `0 8px 20px -8px ${color}`,
                  } : undefined}
                >
                  {statusLabel(opt.value, type)}
                </button>
              )
            })}
          </div>

          {/* rating — 10 stars; clicking the current rating clears it */}
          <span className="detail-modal-label" id={`${ids}-rating`}>
            Rating · {rating ? `${rating} / 10` : 'unrated'}
          </span>
          <div
            className="detail-modal-stars"
            role="radiogroup"
            aria-labelledby={`${ids}-rating`}
            onMouseLeave={() => setHoverRating(null)}
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
              const lit = shownRating !== null && n <= shownRating
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} of 10`}
                  onClick={() => setRating(rating === n ? null : n)}
                  onMouseEnter={() => setHoverRating(n)}
                  className={`rating-star cursor-pointer${lit ? ' is-lit' : ''}`}
                  style={{ transitionDelay: `${(n - 1) * 25}ms` }}
                >
                  ★
                </button>
              )
            })}
          </div>

          {hasProgress && (
            <div className="detail-modal-progress">
              <div className="detail-modal-progress-row">
                <span>
                  {progressCurrent
                    ? `${progressUnit} ${progressCurrent}${progressTotal ? ` of ${progressTotal}` : ''}`
                    : 'No progress logged yet'}
                </span>
                <button type="button" onClick={bump} className="detail-modal-bump cursor-pointer">+1</button>
              </div>
              {progressPct !== null && (
                <div className="cont-progress-track">
                  <div className="cont-progress-bar" style={{ width: `${progressPct}%` }} />
                </div>
              )}
              <div className="detail-modal-fields">
                {isSerial && (
                  <>
                    <NumField label="Season"         value={season}        onChange={setSeason} />
                    <NumField label="Episode"        value={episode}       onChange={setEpisode} />
                    <NumField label="Total episodes" value={totalEpisodes} onChange={setTotalEpisodes} />
                  </>
                )}
                {isBook && (
                  <>
                    <NumField label="Current page" value={currentPage} onChange={setCurrentPage} />
                    <NumField label="Total pages"  value={totalPages}  onChange={setTotalPages} />
                  </>
                )}
                {isPrint && (
                  <>
                    <NumField label="Volume"         value={volume}        onChange={setVolume} />
                    <NumField label="Chapter"        value={chapter}       onChange={setChapter} />
                    <NumField label="Total chapters" value={totalChapters} onChange={setTotalChapters} />
                  </>
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>
          )}

          <div className="detail-modal-footer">
            {/* delete — kept apart from Done so it isn't misclicked */}
            {confirmingDelete ? (
              <div className="detail-modal-confirm">
                <span>Delete "{entry.title}"? This can't be undone.</span>
                {deleteError && <span>{deleteError}</span>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                    className="modal-btn cursor-pointer disabled:opacity-50"
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="modal-btn is-danger cursor-pointer disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="detail-modal-delete cursor-pointer"
              >
                Delete
              </button>
            )}
            <div className="flex gap-2 items-center">
              <button type="button" onClick={onClose} className="detail-modal-cancel cursor-pointer">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="detail-modal-done cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Done'}
              </button>
            </div>
          </div>
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
