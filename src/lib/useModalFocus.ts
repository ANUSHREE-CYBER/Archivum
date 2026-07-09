import { useEffect } from 'react'
import type { RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

// Focus management for modals — what <dialog>.showModal() would give us for
// free. We can't use native <dialog> here: it renders in the browser's top
// layer, above every z-index including the SmoothCursor overlay, and since
// the real cursor is hidden globally (`cursor: none`) the user would have no
// visible cursor inside the modal.
//
// On mount: remembers the element that had focus (the trigger) and moves
// focus to the first interactive control inside the modal. While open: keeps
// Tab / Shift+Tab cycling within the modal instead of escaping into the page
// behind it. On unmount: returns focus to the trigger.
export function useModalFocus(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const modal = ref.current
    if (!modal) return
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null

    modal.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !modal) return
      // Re-queried on every Tab press, not cached — the focusable set changes
      // as buttons disable while saving/deleting and confirm rows mount.
      const focusable = Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (e.shiftKey) {
        if (active === first || !modal.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last || !modal.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      trigger?.focus()
    }
  }, [ref])
}
