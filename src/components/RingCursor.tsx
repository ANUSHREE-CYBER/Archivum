import { useEffect, useRef, useState } from 'react'

const DESKTOP_POINTER_QUERY = '(any-hover: hover) and (any-pointer: fine)'
const EASE = 'cubic-bezier(.2,.8,.2,1)'
const RING_FOLLOW = 0.25

// What counts as "interactive" (ring grows to 46px) and what counts as a card
// (ring grows to 64px with an OPEN label). Cards are matched by their tilt
// layer, which is the element the pointer is actually over on a card.
const INTERACTIVE_SELECTOR = 'button, a, input, label, [data-hover]'
const CARD_SELECTOR = '.card-tilt, [data-cursor-card]'
// Two ways to hide the ring: pointing at anything inside [data-ring-hidden],
// or the same attribute on <html>, which a page can set from its own loop.
// The landing page does the latter while its hero spotlight is dark enough
// to be the cursor itself (overlay alpha > 0.25) — a state that changes with
// scroll, not pointer movement, so it's re-read every frame below.
const HIDDEN_SELECTOR = '[data-ring-hidden]'
const HIDDEN_ATTR = 'data-ring-hidden'

// Ring + dot cursor for the whole app (vault and landing). The OS cursor stays
// hidden by the global `* { cursor: none !important }` in index.css; this is
// the only pointer the user sees.
//
// Positions are written straight to the two DOM nodes from one rAF loop, never
// through React state. The dot sits exactly on the pointer; the ring trails at
// 0.25 per frame. (The handoff's 0.35 / 0.14 read as lag in use — any easing
// on the dot makes the pointer itself feel slow.) Only the hover *mode* (plain /
// interactive / card) touches the DOM outside the loop, and only when it
// changes, so the CSS size transitions have something to animate.
function RingCursor() {
  const [enabled, setEnabled] = useState(false)
  const ringRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_POINTER_QUERY)
    const update = () => setEnabled(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const ring = ringRef.current
    const dot = dotRef.current
    const label = labelRef.current
    if (!ring || !dot || !label) return

    const target = { x: -100, y: -100 }
    const ringPos = { x: -100, y: -100 }
    const dotPos = { x: -100, y: -100 }
    let seen = false
    let inWindow = false
    let visible = false
    let overHidden = false
    let mode: 'plain' | 'hover' | 'card' = 'plain'
    let raf = 0

    function setVisible(next: boolean) {
      if (next === visible) return
      visible = next
      ring!.style.opacity = next ? '1' : '0'
      dot!.style.opacity = next && mode !== 'card' ? '1' : '0'
    }

    function setMode(next: typeof mode) {
      if (next === mode) return
      mode = next
      const size = next === 'card' ? 64 : next === 'hover' ? 46 : 34
      ring!.style.width = ring!.style.height = `${size}px`
      ring!.style.margin = `${-size / 2}px 0 0 ${-size / 2}px`
      ring!.style.backgroundColor = next === 'plain' ? 'transparent' : 'rgba(183,110,121,0.14)'
      label!.style.opacity = next === 'card' ? '1' : '0'
      dot!.style.opacity = visible && next !== 'card' ? '1' : '0'
    }

    function onMove(e: PointerEvent) {
      if (e.pointerType === 'touch') {
        inWindow = false
        return
      }
      target.x = e.clientX
      target.y = e.clientY
      // First sighting: jump there instead of sweeping in from the corner
      if (!seen) {
        seen = true
        ringPos.x = dotPos.x = target.x
        ringPos.y = dotPos.y = target.y
      }
      inWindow = true
      const el = e.target instanceof Element ? e.target : null
      overHidden = !!el?.closest(HIDDEN_SELECTOR)
      setMode(el?.closest(CARD_SELECTOR) ? 'card' : el?.closest(INTERACTIVE_SELECTOR) ? 'hover' : 'plain')
    }

    // relatedTarget null on mouseout from the document = pointer left the window
    function onOut(e: MouseEvent) {
      if (!e.relatedTarget) inWindow = false
    }

    function tick() {
      setVisible(seen && inWindow && !overHidden && !document.documentElement.hasAttribute(HIDDEN_ATTR))
      dotPos.x = target.x
      dotPos.y = target.y
      ringPos.x += (target.x - ringPos.x) * RING_FOLLOW
      ringPos.y += (target.y - ringPos.y) * RING_FOLLOW
      dot!.style.transform = `translate3d(${dotPos.x}px, ${dotPos.y}px, 0)`
      ring!.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('mouseout', onOut)
    raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('mouseout', onOut)
      cancelAnimationFrame(raf)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <>
      <div
        ref={ringRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: 34,
          height: 34,
          margin: '-17px 0 0 -17px',
          border: '1px solid #B76E79',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9998,
          pointerEvents: 'none',
          opacity: 0,
          willChange: 'transform',
          transition: `width .25s ${EASE}, height .25s ${EASE}, margin .25s ${EASE}, background-color .2s ease, opacity .2s ease`,
        }}
      >
        <span
          ref={labelRef}
          style={{
            fontSize: 9,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#E4BCC3',
            opacity: 0,
            transition: 'opacity .2s ease',
            // letter-spacing adds trailing space after the last letter; pull
            // it back so the word sits optically centred in the ring
            marginRight: '-0.2em',
          }}
        >
          Open
        </span>
      </div>
      <div
        ref={dotRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: 5,
          height: 5,
          margin: '-2.5px 0 0 -2.5px',
          borderRadius: '50%',
          background: '#E4BCC3',
          zIndex: 9999,
          pointerEvents: 'none',
          opacity: 0,
          willChange: 'transform',
          transition: 'opacity .2s ease',
        }}
      />
    </>
  )
}

export default RingCursor
