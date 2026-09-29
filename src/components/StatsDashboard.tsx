import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_COLORS } from '../lib/statusColors'
import { TYPE_DOT_COLORS, TYPE_LABELS } from '../lib/typeColors'
import { useTilt } from '../lib/useTilt'

interface Entry {
  id: string
  title: string
  type: string
  status: string
  rating: number | null
  year: number | string | null
  genres: string[] | null
  poster_url: string | null
}

// Fixed order for the stacked bar and its legend: done → doing → queued →
// paused → abandoned, so the bar reads left to right the same way every time
const STATUS_ORDER = ['completed', 'in_progress', 'plan_to_watch', 'on_hold', 'dropped']
const STATUS_LABELS: Record<string, string> = {
  plan_to_watch: 'Plan to Watch / Read',
  in_progress: 'Watching / Reading',
  completed: 'Completed',
  dropped: 'Dropped',
  on_hold: 'On Hold',
}

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const COUNT_UP_MS = 1400
const TIMELINE_THUMBS = 5

// One-time reveal for a panel, observed against <main> (the vault's scroll
// container, not the window). Returns whether the panel has been seen, which
// the panel's bars also key off — they grow from zero only once visible.
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [revealed, setRevealed] = useState(REDUCED_MOTION)
  useEffect(() => {
    const el = ref.current
    if (!el || revealed) return
    const observer = new IntersectionObserver(records => {
      if (records.some(r => r.isIntersecting)) {
        setRevealed(true)
        observer.disconnect()
      }
    }, { root: el.closest('main'), threshold: 0.15 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [revealed])
  return { ref, revealed }
}

// Glass panel that rises into place the first time it scrolls into view.
// `children` is a render function so the contents know when to animate.
function Panel({ className = '', delay = 0, children }: {
  className?: string
  delay?: number
  children: (revealed: boolean) => ReactNode
}) {
  const { ref, revealed } = useReveal<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={`record-panel record-reveal${revealed ? ' is-revealed' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children(revealed)}
    </div>
  )
}

// Counts 0 → value over 1.4s (easeOutQuart) once `run` flips true. Written
// to the text node directly, one rAF per frame, not through state.
function CountUp({ value, decimals = 0, run }: { value: number; decimals?: number; run: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !run) return
    if (REDUCED_MOTION) {
      el.textContent = value.toFixed(decimals)
      return
    }
    const t0 = performance.now()
    let raf = 0
    function step(now: number) {
      const p = Math.min(1, (now - t0) / COUNT_UP_MS)
      const eased = 1 - Math.pow(1 - p, 4)
      el!.textContent = (value * eased).toFixed(decimals)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, decimals, run])
  return <span ref={ref}>{(0).toFixed(decimals)}</span>
}

// Big-number tile. Reveal on the outer element, tilt on the inner one — the
// same "one transform per layer" rule as the vault cards.
function BigStat({ label, value, decimals, delay }: {
  label: string
  value: number | null
  decimals?: number
  delay: number
}) {
  const { ref, revealed } = useReveal<HTMLDivElement>()
  const { tiltRef, glareRef, onMouseMove, onMouseLeave } = useTilt({
    max: 7,
    lift: 'translateZ(30px) translateY(-6px)',
    glare: 0.28,
  })
  return (
    <div
      ref={ref}
      className={`record-reveal${revealed ? ' is-revealed' : ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div
        ref={tiltRef}
        className="record-panel record-big"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <span className="record-big-value">
          {value === null ? '—' : <CountUp value={value} decimals={decimals} run={revealed} />}
        </span>
        <span className="record-eyebrow">{label}</span>
        <div ref={glareRef} className="card-glare" aria-hidden="true" />
      </div>
    </div>
  )
}

export default function StatsDashboard({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [retryTick, setRetryTick] = useState(0)
  const [hoverYear, setHoverYear] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase
      .from('entries')
      .select('id, title, type, status, rating, year, genres, poster_url')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        // Guard against a stale request (e.g. rapid retries) resolving after
        // a newer one and flipping loading back off with outdated data.
        if (cancelled) return
        if (error) {
          // Leave entries untouched on failure — a fetch error must never
          // look like "no entries yet", and any cached stats stay visible.
          setFetchError("Couldn't load your stats. Check your connection and try again.")
        } else {
          setFetchError(null)
          setEntries(data ?? [])
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [userId, retryTick])

  if (loading) {
    return <div className="record-state">Loading…</div>
  }

  if (fetchError && entries.length === 0) {
    return (
      <div className="record-state">
        <p style={{ margin: 0, fontSize: '1.05rem', color: 'var(--color-danger)' }}>{fetchError}</p>
        <button type="button" onClick={() => setRetryTick(t => t + 1)} className="modal-btn is-danger cursor-pointer">
          Retry
        </button>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="record-state">
        <p style={{ margin: 0, fontSize: '1.05rem', color: 'var(--color-text)' }}>No entries yet.</p>
        <p style={{ margin: 0, fontSize: '0.875rem' }}>Add some media to your library to see stats here.</p>
      </div>
    )
  }

  const total = entries.length
  const totalCompleted = entries.filter(e => e.status === 'completed').length
  const rated = entries.filter(e => e.rating != null)
  const avgRating = rated.length > 0
    ? rated.reduce((s, e) => s + e.rating!, 0) / rated.length
    : null

  const count = (key: (e: Entry) => string | null | undefined) => {
    const out: Record<string, number> = {}
    for (const e of entries) {
      const k = key(e)
      if (k) out[k] = (out[k] ?? 0) + 1
    }
    return out
  }

  const statusCounts = count(e => e.status)
  const statusSegs = [
    ...STATUS_ORDER,
    ...Object.keys(statusCounts).filter(k => !STATUS_ORDER.includes(k)),
  ].filter(k => statusCounts[k] > 0).map(k => ({ key: k, count: statusCounts[k] }))

  const typeCounts = count(e => e.type)
  const typeBars = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])
  const maxType = Math.max(...typeBars.map(([, c]) => c))

  const genreCounts: Record<string, number> = {}
  for (const e of entries) for (const g of e.genres ?? []) genreCounts[g] = (genreCounts[g] ?? 0) + 1
  const genreBars = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxGenre = genreBars.length ? genreBars[0][1] : 1

  const byYear: Record<string, Entry[]> = {}
  for (const e of entries) {
    if (e.year == null || e.year === '') continue
    const y = String(e.year)
    ;(byYear[y] ??= []).push(e)
  }
  const years = Object.keys(byYear).sort((a, b) => Number(a) - Number(b))

  return (
    <div className="record">
      <div className="record-header">
        <h1 className="record-title">The Record</h1>
        <span className="record-eyebrow">Your archive, in numbers</span>
      </div>

      {/* Non-blocking: shown when a refresh failed but there's still
          previously-loaded data to chart, so stats stay visible. */}
      {fetchError && (
        <div className="record-error">
          <p>{fetchError}</p>
          <button type="button" onClick={() => setRetryTick(t => t + 1)} className="modal-btn is-danger cursor-pointer">
            Retry
          </button>
        </div>
      )}

      <div className="record-bigs">
        <BigStat label="Total entries" value={total} delay={0} />
        <BigStat label="Completed" value={totalCompleted} delay={70} />
        <BigStat label="Avg rating" value={avgRating} decimals={1} delay={140} />
      </div>

      {/* Stacked bar instead of the old donut — with only one or two
          statuses in use, a donut read as a single solid ring */}
      <Panel>
        {revealed => (
          <>
            <div className="record-panel-head">
              <span className="record-eyebrow">Status breakdown</span>
              <span className="record-panel-note">{total} {total === 1 ? 'title' : 'titles'}</span>
            </div>
            <div className="record-status-bar">
              {statusSegs.map((s, i) => (
                <div
                  key={s.key}
                  title={`${STATUS_LABELS[s.key] ?? s.key}: ${s.count}`}
                  style={{
                    width: revealed ? `${(s.count / total) * 100}%` : '0%',
                    background: STATUS_COLORS[s.key] ?? STATUS_COLORS.dropped,
                    transitionDelay: `${i * 120}ms`,
                  }}
                />
              ))}
            </div>
            <div className="record-legend">
              {statusSegs.map(s => (
                <span key={s.key}>
                  <span className="record-legend-dot" style={{ background: STATUS_COLORS[s.key] ?? STATUS_COLORS.dropped }} />
                  {STATUS_LABELS[s.key] ?? s.key}
                  <span className="record-muted">{s.count}</span>
                </span>
              ))}
            </div>
          </>
        )}
      </Panel>

      <div className="record-pair">
        <Panel>
          {revealed => (
            <>
              <span className="record-eyebrow record-panel-title">By type</span>
              <div className="record-type-track">
                {typeBars.map(([type, c], i) => (
                  <div key={type} className="record-type-col">
                    <span className="record-type-count">{c}</span>
                    <div
                      className="record-type-bar"
                      style={{
                        // 82% of the track at most, leaving room for the count above
                        height: revealed ? `${(c / maxType) * 82}%` : '0%',
                        background: `linear-gradient(180deg, ${TYPE_DOT_COLORS[type] ?? '#6B6660'}, ${TYPE_DOT_COLORS[type] ?? '#6B6660'}55)`,
                        transitionDelay: `${i * 80}ms`,
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="record-type-labels">
                {typeBars.map(([type]) => (
                  <span key={type} title={TYPE_LABELS[type] ?? type}>{TYPE_LABELS[type] ?? type}</span>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel delay={70}>
          {revealed => (
            <>
              <span className="record-eyebrow record-panel-title">Top genres</span>
              {genreBars.length === 0 ? (
                <p className="record-empty">No genre data yet</p>
              ) : (
                <div className="record-genres">
                  {genreBars.map(([genre, c], i) => (
                    <div key={genre} className="record-genre-row">
                      <span className="record-genre-label" title={genre}>{genre}</span>
                      <div className="record-genre-track">
                        <div
                          style={{
                            width: revealed ? `${(c / maxGenre) * 100}%` : '0%',
                            background: `linear-gradient(90deg, #96555F, ${i === 0 ? '#E4BCC3' : '#C98A93'})`,
                            opacity: 1 - i * 0.07,
                            transitionDelay: `${i * 70}ms`,
                          }}
                        />
                      </div>
                      <span className="record-muted">{c}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Panel>
      </div>

      {/* Replaces "Entries by year": each release year is a little stack of
          its posters that fans out sideways on hover */}
      <Panel className="record-timeline-panel">
        {() => (
          <>
            <div className="record-panel-head record-timeline-head">
              <span className="record-eyebrow">Timeline · by release year</span>
              <span className="record-panel-note">Hover a year to fan it open</span>
            </div>
            {years.length === 0 ? (
              <p className="record-empty" style={{ padding: '0 24px' }}>No release years recorded yet</p>
            ) : (
              <div className="record-timeline">
                {years.map(year => {
                  const list = byYear[year]
                  const thumbs = list.slice(0, TIMELINE_THUMBS)
                  const open = hoverYear === year
                  return (
                    <div
                      key={year}
                      className={`record-year${open ? ' is-open' : ''}`}
                      style={{ width: open ? 64 + (thumbs.length - 1) * 50 : 64 }}
                      onMouseEnter={() => setHoverYear(year)}
                      onMouseLeave={() => setHoverYear(null)}
                      data-hover=""
                    >
                      <div className="record-year-stack">
                        {thumbs.map((e, i) => (
                          <div
                            key={e.id}
                            className="record-thumb"
                            title={e.title}
                            style={{
                              zIndex: 10 - i,
                              background: e.poster_url ? '#0C0C0C' : `linear-gradient(180deg, ${TYPE_DOT_COLORS[e.type] ?? '#6B6660'}55, #0c0c0c)`,
                              transform: open
                                ? `translateX(${i * 50}px) translateY(-8px) rotate(0deg)`
                                : `translateX(${i * 4}px) translateY(${-i * 5}px) rotate(${i * 4}deg)`,
                              transitionDelay: `${i * 30}ms`,
                            }}
                          >
                            {e.poster_url && <img src={e.poster_url} alt="" loading="lazy" decoding="async" />}
                          </div>
                        ))}
                      </div>
                      <div className="record-year-rule" />
                      <span className="record-year-label">{year}</span>
                      <span className="record-year-count">{list.length}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  )
}
