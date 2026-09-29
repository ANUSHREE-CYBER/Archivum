import { useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'

// Bundled posters, used when the vault has no poster URLs of its own yet
// (a brand-new account, or entries that were all added manually).
const LOCAL_POSTERS = Object.values(
  import.meta.glob<string>('../assets/Posters/*.jpg', { eager: true, import: 'default' }),
)

// 12 columns × 4 rows fill one "half" of the track; the track holds that half
// twice, so translating by exactly one half lands on an identical frame and
// the drift loops without a seam.
const HALF_TILES = 48
const GAP = 20
// px per second the floor drifts away from the viewer, plus how much of
// <main>'s scroll offset is coupled in
const DRIFT_SPEED = 12
const SCROLL_COUPLING = 0.1

// Vault backdrop: a grayscale, blurred wall of the user's own posters lying on
// a floor tilted away from the viewer, drifting slowly into the distance under
// three darkening overlays. It is meant to be texture, not content — the cards
// must always win, so if it ever reads as too present, lower the track's
// opacity (0.16) rather than touching the overlays.
//
// Same slot as the old aurora: fixed, behind everything, no pointer events.
// Motion is one rAF loop writing a single transform to the track node.
// `scrollRef` is <main>, the vault's scroll container — not the window.
function QuietWallBackground({ posters, scrollRef }: {
  posters: string[]
  scrollRef: RefObject<HTMLElement | null>
}) {
  const trackRef = useRef<HTMLDivElement>(null)

  // Keyed on the joined URL list so a re-render of App with the same entries
  // (or a status change, which doesn't touch posters) doesn't rebuild tiles
  const key = posters.join('|')
  const tiles = useMemo(() => {
    const unique = Array.from(new Set(key ? key.split('|') : []))
    const source = unique.length > 0 ? unique : LOCAL_POSTERS
    const half = Array.from({ length: HALF_TILES }, (_, i) => source[i % source.length])
    return [...half, ...half]
  }, [key])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    let paused = 0
    let pausedAt = 0
    function tick(now: number) {
      // Hold still while a modal is open: the modals' frosted glass has to
      // re-blur whatever moves behind it, every frame. Time spent paused is
      // subtracted so the wall resumes where it stopped instead of jumping.
      if (document.querySelector('[aria-modal="true"]')) {
        if (!pausedAt) pausedAt = now
        raf = requestAnimationFrame(tick)
        return
      }
      if (pausedAt) {
        paused += now - pausedAt
        pausedAt = 0
      }
      // Two identical halves separated by one grid gap: the loop length is
      // half the track plus half a gap, which is exactly one half's pitch.
      const loop = (track!.offsetHeight + GAP) / 2 || 1
      const scroll = scrollRef.current?.scrollTop ?? 0
      const off = (((now - paused) / 1000) * DRIFT_SPEED + scroll * SCROLL_COUPLING) % loop
      track!.style.transform = `translate3d(0, ${-off}px, 0)`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [scrollRef])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ perspective: 900 }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '30%',
          width: '220vw',
          marginLeft: '-110vw',
          transformStyle: 'preserve-3d',
          transform: 'rotateX(62deg)',
        }}
      >
        <div
          ref={trackRef}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
            gap: GAP,
            opacity: 0.16,
            willChange: 'transform',
          }}
        >
          {tiles.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              loading="lazy"
              decoding="async"
              // The filter lives on each tile, not the moving track: that way
              // it's rasterised once into the track's layer, and each frame
              // only moves the layer. On the track itself it was re-applied
              // to a 220vw-wide surface every frame.
              style={{ display: 'block', width: '100%', aspectRatio: '2/3', objectFit: 'cover', borderRadius: 8, filter: 'grayscale(1) blur(2px) brightness(0.8)' }}
            />
          ))}
        </div>
      </div>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #080808 0%, rgba(8,8,8,0.8) 40%, rgba(8,8,8,0.6) 70%, rgba(8,8,8,0.9) 100%)' }} />
      {/* extra darkness behind the card area */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 70% at 50% 55%, rgba(8,8,8,0.85) 0%, transparent 80%)' }} />
      {/* faint rose floor glow */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(183,110,121,0.12) 0%, transparent 55%)' }} />
    </div>
  )
}

export default QuietWallBackground
