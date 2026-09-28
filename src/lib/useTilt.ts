import { useCallback, useRef } from 'react'

const FINE_POINTER = typeof window !== 'undefined'
  && window.matchMedia('(hover: hover) and (pointer: fine)').matches
const REDUCED_MOTION = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface TiltOptions {
  // Peak rotation either side, in degrees: at the card's edge the formula
  // gives (±0.5)·2·max, so `max: 7` means a 14° swing edge to edge.
  max?: number
  // Extra transform prepended while hovering (e.g. 'translateZ(30px) translateY(-6px)')
  lift?: string
  perspective?: number
  // Peak alpha of the pale-rose glare that follows the pointer; 0 = none
  glare?: number
  disabled?: boolean
}

// Pointer-following 3D tilt + glare, the EntryCard pattern made reusable:
// the transform is written straight to the DOM node (never React state, which
// would re-render per frame), coalesced through requestAnimationFrame so there
// is at most one rect read + style write per frame, and the rect is read fresh
// each time so a scrolling container never leaves the maths stale.
//
// The element carrying `tiltRef` must be its own layer — not an element whose
// transform is owned by an entrance animation or a Framer Motion `layout`
// node, since both overwrite inline transforms. Emptying the transform on
// leave hands control back to the stylesheet, whose transition eases it flat.
export function useTilt<T extends HTMLElement = HTMLDivElement>({
  max = 7, lift = '', perspective = 800, glare = 0, disabled = false,
}: TiltOptions = {}) {
  const tiltRef = useRef<T>(null)
  const glareRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)
  const active = FINE_POINTER && !REDUCED_MOTION && !disabled

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!active) return
    const el = tiltRef.current
    if (!el) return
    const { clientX, clientY } = e
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect()
      const px = (clientX - rect.left) / rect.width    // 0 … 1
      const py = (clientY - rect.top) / rect.height
      const rx = (0.5 - py) * max * 2
      const ry = (px - 0.5) * max * 2
      el.style.transform =
        `perspective(${perspective}px) ${lift} rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`
      const g = glareRef.current
      if (g && glare > 0) {
        g.style.opacity = '1'
        g.style.background =
          `radial-gradient(circle at ${(px * 100).toFixed(1)}% ${(py * 100).toFixed(1)}%, rgba(228,188,195,${glare}), transparent 55%)`
      }
    })
  }, [active, max, lift, perspective, glare])

  const onMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    if (tiltRef.current) tiltRef.current.style.transform = ''
    if (glareRef.current) glareRef.current.style.opacity = '0'
  }, [])

  return { tiltRef, glareRef, onMouseMove, onMouseLeave }
}
