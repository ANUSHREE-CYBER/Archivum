import { useEffect, useRef, useState } from 'react'
import type { EditableEntry } from './EntryEditModal'
import CoverFallback from './CoverFallback'
import { TYPE_LABELS } from '../lib/typeColors'
import { readProgress, progressLabel } from '../lib/progress'
import { sharpPoster } from '../lib/utils'

// Autoplay interval. It runs whether or not the pointer is over the stage —
// the fill in the active dot shows how long is left — and pauses only while
// a modal is open or the tab is hidden, so nothing advances behind the user's
// back while they're editing an entry or away.
const AUTOPLAY_MS = 5000
const EASE = 'cubic-bezier(.2,.8,.2,1)'
const SWIPE_PX = 40

const REDUCED_MOTION = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
}

const modalOpen = () => !!document.querySelector('[aria-modal="true"]')

// The Continue carousel: in-progress entries as a fanned 3D stack on the
// right, the front one's title/progress/actions on the left, its poster
// blurred behind everything. Replaces the old horizontal Continue shelf.
//
// Per-frame work (autoplay clock, dot fill, mouse/scroll parallax, float) is
// one rAF loop writing to refs; React state changes only when the front card
// changes. Card positions are plain CSS transitions keyed off that index.
function ContinueStage({ entries, onOpen, onBump }: {
  entries: EditableEntry[]
  onOpen: (entry: EditableEntry) => void
  onBump: (entry: EditableEntry) => void
}) {
  const [index, setIndex] = useState(0)
  // ids whose poster failed to load — they get the designed cover instead
  const [broken, setBroken] = useState<Set<string>>(() => new Set())
  const n = entries.length
  // `index` can point past the end after an entry completes and leaves the
  // list; wrapping here (rather than resetting state) keeps the neighbour
  // in front instead of jumping back to the first card.
  const ci = n ? index % n : 0
  const front = entries[ci]

  const stageRef = useRef<HTMLDivElement>(null)
  const spinRef = useRef<HTMLDivElement>(null)
  const infoRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLSpanElement>(null)
  const shineRef = useRef<HTMLDivElement>(null)
  const elapsedRef = useRef(0)
  const swipeStartRef = useRef<number | null>(null)
  const swipedRef = useRef(false)
  const firstRenderRef = useRef(true)

  function step(delta: number) {
    if (n < 2) return
    elapsedRef.current = 0
    setIndex(i => (((i % n) + delta) % n + n) % n)
  }

  function goTo(i: number) {
    elapsedRef.current = 0
    setIndex(i)
  }

  // Autoplay clock + parallax + float, all in one loop
  useEffect(() => {
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 }
    function onMove(e: PointerEvent) {
      const stage = stageRef.current
      if (!stage) return
      const r = stage.getBoundingClientRect()
      mouse.tx = clamp((e.clientX - r.left) / r.width - 0.5, -1, 1)
      mouse.ty = clamp((e.clientY - r.top) / r.height - 0.5, -1, 1)
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    let raf = 0
    let last = performance.now()
    function tick(t: number) {
      // Capped, so the first frame after the tab comes back (or after any
      // stall) can't dump seconds of "elapsed" time in one go and skip a card
      const dt = Math.min(t - last, 100)
      last = t

      if (n > 1 && !document.hidden && !modalOpen()) {
        elapsedRef.current += dt
        if (elapsedRef.current >= AUTOPLAY_MS) {
          elapsedRef.current = 0
          setIndex(i => ((i % n) + 1) % n)
        }
      }
      if (fillRef.current) {
        fillRef.current.style.width = `${Math.min(1, elapsedRef.current / AUTOPLAY_MS) * 100}%`
      }

      const spin = spinRef.current
      const stage = stageRef.current
      const r = spin && stage && !REDUCED_MOTION ? stage.getBoundingClientRect() : null
      // Parallax + float only while the stage is on screen — no point
      // re-compositing a 3D fan nobody can see
      if (spin && r && r.bottom > 0 && r.top < window.innerHeight) {
        mouse.x += (mouse.tx - mouse.x) * 0.08
        mouse.y += (mouse.ty - mouse.y) * 0.08
        // -1 … 1 as the stage's centre moves from the bottom of the window to
        // the top: tips the fan back a little as you scroll past it
        const sp = clamp(1 - (r.top + r.height / 2) / window.innerHeight, -1, 1)
        spin.style.transform =
          `rotateY(${(mouse.x * 10).toFixed(2)}deg) rotateX(${(-mouse.y * 6 + sp * 10).toFixed(2)}deg) translateY(${(Math.sin(t / 1100) * 6).toFixed(2)}px)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
    }
  }, [n])

  // On every change of front card: restart the clock, re-enter the left
  // column (staggered), and sweep a shine across the new front card
  useEffect(() => {
    elapsedRef.current = 0
    if (firstRenderRef.current) {
      firstRenderRef.current = false
      return
    }
    if (REDUCED_MOTION) return
    infoRef.current?.querySelectorAll<HTMLElement>('[data-cont-text]').forEach((el, i) => {
      el.animate(
        [
          { opacity: 0, transform: 'translateY(18px)', filter: 'blur(8px)' },
          { opacity: 1, transform: 'none', filter: 'blur(0)' },
        ],
        { duration: 700, delay: i * 60, easing: EASE, fill: 'backwards' },
      )
    })
    shineRef.current?.animate(
      [{ transform: 'translateX(-120%)' }, { transform: 'translateX(120%)' }],
      { duration: 1100, delay: 350, easing: 'ease-in-out' },
    )
  }, [ci, front?.id])

  // ← / → step the carousel, unless the user is typing or in a modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (e.altKey || e.ctrlKey || e.metaKey || isTyping(e.target) || modalOpen()) return
      step(e.key === 'ArrowRight' ? 1 : -1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Horizontal swipe on the card stage (≥ 40px). Listening for the release on
  // window means a swipe that ends outside the stage still counts.
  useEffect(() => {
    function onUp(e: PointerEvent) {
      const start = swipeStartRef.current
      if (start === null) return
      swipeStartRef.current = null
      const dx = e.clientX - start
      if (Math.abs(dx) >= SWIPE_PX) {
        swipedRef.current = true
        step(dx < 0 ? 1 : -1)
      }
    }
    window.addEventListener('pointerup', onUp)
    return () => window.removeEventListener('pointerup', onUp)
  })

  if (!front) return null

  const progress = readProgress(front)
  const label = progress ? progressLabel(progress) : null
  const meta = [
    TYPE_LABELS[front.type] ?? front.type,
    front.year,
    front.genres?.slice(0, 3).join(', '),
  ].filter(Boolean).join(' · ')
  const spacing = Math.min(150, window.innerWidth * 0.1)

  return (
    <section className="cont-stage" aria-roledescription="carousel" aria-label="Continue">
      {entries.map((e, i) => e.poster_url && (
        <div
          key={e.id}
          aria-hidden="true"
          className="cont-bg"
          style={{
            backgroundImage: `url("${e.poster_url}")`,
            opacity: i === ci ? 0.55 : 0,
            transform: i === ci ? 'scale(1.05)' : 'scale(1.2)',
          }}
        />
      ))}
      <div className="cont-scrim" aria-hidden="true" />

      <div className="cont-grid">
        <div ref={infoRef} className="cont-info" aria-live="polite">
          <span data-cont-text className="cont-eyebrow">
            <span className="cont-eyebrow-dot" />
            Continue · {ci + 1} / {n}
          </span>
          <h2 data-cont-text className="cont-title">{front.title}</h2>
          <span data-cont-text className="cont-meta">{meta}</span>

          {progress && (
            <div data-cont-text className="cont-progress">
              <div className="cont-progress-label">
                <span>{label ?? 'No progress logged yet'}</span>
                {progress.percent !== null && <span className="cont-progress-pct">{Math.round(progress.percent)}%</span>}
              </div>
              {progress.percent !== null && (
                <div className="cont-progress-track">
                  <div className="cont-progress-bar" style={{ width: `${progress.percent}%` }} />
                </div>
              )}
            </div>
          )}

          <div data-cont-text className="cont-actions">
            {progress && (
              <button type="button" onClick={() => onBump(front)} className="cont-btn is-primary cursor-pointer">
                +1 {progress.unit}
              </button>
            )}
            <button type="button" onClick={() => onOpen(front)} className="cont-btn cursor-pointer">
              Open entry
            </button>
          </div>

          {n > 1 && (
            <div className="cont-nav">
              <button type="button" onClick={() => step(-1)} className="cont-arrow cursor-pointer" aria-label="Previous">←</button>
              <div className="cont-dots">
                {entries.map((e, i) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => goTo(i)}
                    className={`cont-dot cursor-pointer${i === ci ? ' is-active' : ''}`}
                    aria-label={`Show ${e.title}`}
                    aria-current={i === ci}
                  >
                    {i === ci && <span ref={fillRef} className="cont-dot-fill" />}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => step(1)} className="cont-arrow cursor-pointer" aria-label="Next">→</button>
            </div>
          )}
        </div>

        <div
          ref={stageRef}
          className="cont-cards"
          onPointerDown={e => {
            swipeStartRef.current = e.clientX
            swipedRef.current = false
          }}
        >
          <div ref={spinRef} className="cont-spin">
            {entries.map((e, i) => {
              // Shortest way round, so the fan is balanced either side of
              // the front card instead of trailing off to one side
              let off = i - ci
              if (off > n / 2) off -= n
              if (off < -n / 2) off += n
              const a = Math.abs(off)
              const isFront = off === 0
              const pct = readProgress(e)?.percent ?? null
              return (
                <div
                  key={e.id}
                  className={`cont-card${isFront ? ' is-front' : ''}`}
                  data-cursor-card={isFront ? '' : undefined}
                  data-hover={isFront ? undefined : ''}
                  role="button"
                  tabIndex={a > 2 ? -1 : 0}
                  aria-label={isFront ? `Open ${e.title}` : `Show ${e.title}`}
                  onClick={() => {
                    // A swipe that started on a card shouldn't also click it
                    if (swipedRef.current) return
                    if (isFront) onOpen(e)
                    else goTo(i)
                  }}
                  onKeyDown={ev => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault()
                      if (isFront) onOpen(e)
                      else goTo(i)
                    }
                  }}
                  style={{
                    transform: `translate(-50%, -50%) translateX(${off * spacing}px) translateZ(${isFront ? 60 : -a * 170}px) rotateY(${-off * 30}deg)`,
                    opacity: a > 2 ? 0 : 1 - a * 0.28,
                    zIndex: 10 - a,
                    filter: isFront ? 'none' : 'brightness(0.6)',
                    pointerEvents: a > 2 ? 'none' : undefined,
                  }}
                >
                  {e.poster_url && !broken.has(e.id) ? (
                    <img
                      src={sharpPoster(e.poster_url)!}
                      alt=""
                      decoding="async"
                      draggable={false}
                      onError={() => setBroken(prev => new Set(prev).add(e.id))}
                    />
                  ) : (
                    <CoverFallback type={e.type} title={e.title} year={e.year} size="lg" />
                  )}
                  {isFront && <div ref={shineRef} className="cont-card-shine" aria-hidden="true" />}
                  {pct !== null && (
                    <div className="cont-card-bar" aria-hidden="true">
                      <div style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

export default ContinueStage
