import { useEffect, useRef, useState } from 'react'

export interface DropdownOption {
  value: string
  label: string
}

interface Props {
  options: DropdownOption[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
}

// Custom replacement for native <select> — the OS renders native option lists
// (blue highlight, system styling) with no way to theme them. Focus stays on
// the trigger button the whole time (a "combobox-lite" pattern): the options
// are non-focusable divs, so all keyboard handling lives on the root and the
// menu can't steal focus.
export default function Dropdown({ options, value, onChange, ariaLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  // Keep the highlighted option visible when arrowing through a long menu
  useEffect(() => {
    if (!open) return
    menuRef.current?.children[highlighted]?.scrollIntoView({ block: 'nearest' })
  }, [open, highlighted])

  function openMenu() {
    const idx = options.findIndex(o => o.value === value)
    setHighlighted(idx >= 0 ? idx : 0)
    setOpen(true)
  }

  function choose(next: string) {
    setOpen(false)
    if (next !== value) onChange(next)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openMenu()
      }
      return
    }
    if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(options[highlighted].value)
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={handleKeyDown}
      onBlur={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`dropdown-trigger text-xs cursor-pointer ${open ? 'is-open' : ''}`}
      >
        {selected?.label ?? value}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden="true"
          className="dropdown-chevron flex-shrink-0"
          style={{ transform: open ? 'rotate(180deg)' : undefined }}
        >
          <path
            d="M2 3.5 L5 6.5 L8 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="listbox"
          aria-label={ariaLabel}
          className="dropdown-menu absolute left-0 top-full mt-1.5 z-50"
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value
            return (
              <div
                key={opt.value || opt.label}
                role="option"
                aria-selected={isSelected}
                className="dropdown-option cursor-pointer"
                style={{
                  background: isSelected
                    ? 'rgba(255, 255, 255, 0.1)'
                    : i === highlighted
                      ? 'rgba(255, 255, 255, 0.06)'
                      : 'transparent',
                }}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => choose(opt.value)}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <span aria-hidden="true">✓</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
