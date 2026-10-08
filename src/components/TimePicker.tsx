import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { formatTime, loadPreferences } from '../lib/preferences'
import FieldPopover from './FieldPopover'
import { Icon } from './Icons'

const pad = (n: number) => String(n).padStart(2, '0')
const parse = (v: string) => (/^\d{2}:\d{2}$/.test(v) ? { h: Number(v.slice(0, 2)), m: Number(v.slice(3, 5)) } : null)

interface Item { v: number; text: string }

/** One scrolling column of choices. The chosen one is kept centred, and Up/Down move through them. */
function Column({ items, selected, onPick, label, short }: { items: Item[]; selected: number; onPick: (v: number) => void; label: string; short?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  useEffect(() => {
    const c = ref.current, el = c?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!c || !el) return
    if (c.contains(document.activeElement)) el.focus({ preventScroll: true })
    c.scrollTo({ top: el.offsetTop - c.clientHeight / 2 + el.offsetHeight / 2, behavior: first.current ? 'auto' : 'smooth' })
    first.current = false
  }, [selected])

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const i = items.findIndex(it => it.v === selected)
    const next = items[Math.min(items.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]
    if (next) onPick(next.v)
  }

  return (
    <div ref={ref} className="tp-col" data-short={short} role="listbox" aria-label={label} onKeyDown={onKey}>
      {items.map(it => (
        <button key={it.v} type="button" role="option" className="tp-item" aria-selected={it.v === selected} tabIndex={it.v === selected ? 0 : -1} onClick={() => onPick(it.v)}>{it.text}</button>
      ))}
    </div>
  )
}

interface Props {
  /** HH:MM, or an empty string when no time is set. */
  value: string
  onChange: (v: string) => void
  label: string
  id?: string
  /** Shows a Clear button and allows the field to stay empty. */
  optional?: boolean
  placeholder?: string
  /** Where the picker starts when nothing is set yet. */
  fallback?: string
}

/** A time field where the whole bar opens a polished hour / minute picker, in the same style as the date picker. */
export default function TimePicker({ value, onChange, label, id, optional = false, placeholder = 'Select time', fallback = '09:00' }: Props) {
  const h24 = loadPreferences().timeFormat === '24h'
  const wrap = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  const has = !!parse(value)
  const t = parse(value) ?? parse(fallback) ?? { h: 9, m: 0 }
  const shown = formatTime(new Date(2000, 0, 1, t.h, t.m), h24 ? '24h' : '12h')
  const pm = t.h >= 12
  const set = (h: number, m: number) => onChange(`${pad(h)}:${pad(m)}`)
  const close = (refocus = false) => { setOpen(false); if (refocus) bar.current?.focus() }

  const hours: Item[] = h24
    ? Array.from({ length: 24 }, (_, h) => ({ v: h, text: pad(h) }))
    : Array.from({ length: 12 }, (_, i) => ({ v: i + 1, text: String(i + 1) }))
  const minutes: Item[] = Array.from({ length: 60 }, (_, m) => ({ v: m, text: pad(m) }))
  const periods: Item[] = [{ v: 0, text: 'AM' }, { v: 1, text: 'PM' }]

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) { e.stopPropagation(); close(true) }
    else if (e.key === 'ArrowDown' && !open && e.target === bar.current) { e.preventDefault(); setOpen(true) }
  }

  return (
    <div ref={wrap} className="tp" onKeyDown={onKey}>
      <button ref={bar} id={id} type="button" className="tp-bar" data-open={open} data-empty={!has} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span>{has ? shown : placeholder}</span>
        <span aria-hidden="true" className="dp-open"><Icon name="clock" className="size-[18px]" /></span>
      </button>

      {open && (
        <FieldPopover anchor={wrap} popRef={pop} label={`${label} picker`} width={250} onClose={() => close()}>
          <div className="tp-head"><span>{label}</span><strong>{shown}</strong></div>
          <div className="tp-cols" data-h24={h24}>
            <Column label="Hour" items={hours} selected={h24 ? t.h : t.h % 12 || 12} onPick={n => set(h24 ? n : (n % 12) + (pm ? 12 : 0), t.m)} />
            <Column label="Minute" items={minutes} selected={t.m} onPick={n => set(t.h, n)} />
            {!h24 && <Column short label="AM or PM" items={periods} selected={pm ? 1 : 0} onPick={n => set((t.h % 12) + (n ? 12 : 0), t.m)} />}
          </div>
          <div className="dp-foot">
            {optional ? <button type="button" disabled={!has} onClick={() => { onChange(''); close(true) }}>Clear</button> : <span />}
            <button type="button" onClick={() => { if (!has) set(t.h, t.m); close(true) }}>Done</button>
          </div>
        </FieldPopover>
      )}
    </div>
  )
}
