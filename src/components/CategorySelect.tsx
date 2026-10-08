import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Icon, type IconName } from './Icons'

export interface CategoryOption { id: string; label: string; count: number; color?: string; icon?: IconName }

interface Props {
  value: string
  options: CategoryOption[]
  onChange: (id: string) => void
}

const FALLBACK = '#64e8d3'
const css = (v: Record<string, string | number>) => v as CSSProperties

/** Four rounded squares, the glyph for "all categories". */
function AllGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true">
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.8" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" />
    </svg>
  )
}

/**
 * Category picker: a glass pill that opens a frosted menu. The menu stays mounted and is driven by `data-open`,
 * so opening, closing and interrupting mid-animation all use the same smooth transitions.
 * Keyboard: Arrow keys / Home / End move, Enter or Space picks, Escape closes (focus stays on the pill).
 */
export default function CategorySelect({ value, options, onChange }: Props) {
  const uid = useId()
  const listId = `${uid}-list`
  const optId = (i: number) => `${uid}-opt-${i}`
  const root = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const selected = Math.max(0, options.findIndex(o => o.id === value))
  const cur = options[selected]
  const [open, setOpen] = useState(false)
  const [hl, setHl] = useState(selected)
  const hi = Math.min(hl, options.length - 1)

  const show = () => { setHl(selected); setOpen(true) }
  const close = (refocus = false) => { setOpen(false); if (refocus) btn.current?.focus() }
  const pick = (i: number) => { onChange(options[i].id); close(true) }

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  const onKey = (e: KeyboardEvent) => {
    const n = options.length
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show() }
      return
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setHl((hi + 1) % n); break
      case 'ArrowUp': e.preventDefault(); setHl((hi - 1 + n) % n); break
      case 'Home': e.preventDefault(); setHl(0); break
      case 'End': e.preventDefault(); setHl(n - 1); break
      case 'Enter': case ' ': e.preventDefault(); pick(hi); break
      case 'Escape': e.preventDefault(); close(); break
      case 'Tab': close(); break
    }
  }

  return (
    <div ref={root} className="hb-sel">
      <button ref={btn} type="button" role="combobox" className="hb-select" data-open={open} data-tint={!!cur.color}
        style={css({ '--c': cur.color ?? FALLBACK })}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-label={`Category: ${cur.label}`}
        aria-activedescendant={open ? optId(hi) : undefined}
        onClick={e => { if (e.detail === 0) return; open ? close() : show() }} onKeyDown={onKey}>
        <span className="hb-select-ico">{cur.icon ? <Icon name={cur.icon} className="size-3.5" /> : <AllGlyph />}</span>
        <span key={cur.id} className="swap">{cur.label}</span>
        <Icon name="chevron" className="hb-select-chev size-4" />
      </button>

      <div id={listId} role="listbox" aria-label="Category" className="hb-menu glass" data-open={open} inert={!open}>
        <span aria-hidden="true" className="hb-menu-hl" style={css({ '--i': hi, '--c': options[hi].color ?? FALLBACK })} />
        {options.map((o, i) => (
          <div key={o.id} id={optId(i)} role="option" aria-selected={i === selected} data-sel={i === selected} data-div={i === 1}
            className="hb-opt" style={css({ '--i': i, '--c': o.color ?? FALLBACK })}
            onMouseEnter={() => setHl(i)} onClick={() => pick(i)}>
            <span className="hb-opt-ico">{o.icon ? <Icon name={o.icon} className="size-3.5" /> : <AllGlyph />}</span>
            <span className="hb-opt-label">{o.label}</span>
            <span className="hb-opt-count">{o.count}</span>
            <svg viewBox="0 0 24 24" className="hb-opt-tick" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
            </svg>
          </div>
        ))}
      </div>
    </div>
  )
}
