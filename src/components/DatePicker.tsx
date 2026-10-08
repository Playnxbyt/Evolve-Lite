import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import FieldPopover from './FieldPopover'
import { Icon } from './Icons'

type View = 'days' | 'months' | 'years'
type Part = 'day' | 'month' | 'year'
type Dir = 'next' | 'prev' | 'zoom'
interface YMD { y: number; m: number; d: number } // m is 0-based

const pad = (n: number, l = 2) => String(n).padStart(l, '0')
const toIso = (y: number, m: number, d: number) => `${pad(y, 4)}-${pad(m + 1)}-${pad(d)}`
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate()

function parseIso(s: string | undefined): YMD | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > daysIn(y, m - 1)) return null
  return { y, m: m - 1, d }
}

const LEN: Record<Part, number> = { day: 2, month: 2, year: 4 }
const TOKEN: Record<Part, string> = { day: 'DD', month: 'MM', year: 'YYYY' }

/** Day / month / year order for typing. Follows the browser's region unless the ISO format is chosen. */
function typingOrder(iso: boolean): Part[] {
  if (iso) return ['year', 'month', 'day']
  try {
    const order = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(2001, 10, 22)).map(p => p.type)
      .filter((t): t is Part => t === 'day' || t === 'month' || t === 'year')
    if (order.length === 3) return order
  } catch { /* fall through */ }
  return ['day', 'month', 'year']
}

/** Turns whatever was typed into a tidy "19-07-2008", adding dashes for you and padding single digits when you type a separator. */
function maskTyped(raw: string, prev: string, order: Part[]) {
  const groups = raw.split(/\D+/).filter(Boolean)
  const typedSeparator = raw.length > prev.length && /\D$/.test(raw)
  let digits = groups.map((g, i) => ((i < groups.length - 1 || typedSeparator) && g.length === 1 && order[i] !== 'year' ? `0${g}` : g)).join('').slice(0, 8)
  const out: string[] = []
  for (const p of order) {
    if (!digits) break
    out.push(digits.slice(0, LEN[p]))
    digits = digits.slice(LEN[p])
  }
  return out.join('-')
}

function typedToIso(text: string, order: Part[]): string | null {
  const parts = text.split('-')
  if (parts.length !== 3 || parts.some((p, i) => p.length !== LEN[order[i]])) return null
  const v: Record<Part, number> = { day: 0, month: 0, year: 0 }
  order.forEach((p, i) => { v[p] = Number(parts[i]) })
  const iso = toIso(v.year, v.month - 1, v.day)
  return parseIso(iso) ? iso : null
}

const fmt = (iso: string, order: Part[]) => {
  const p = parseIso(iso)
  if (!p) return ''
  const v: Record<Part, string> = { day: pad(p.d), month: pad(p.m + 1), year: pad(p.y, 4) }
  return order.map(o => v[o]).join('-')
}

interface Props {
  /** ISO date (YYYY-MM-DD) or an empty string. */
  value: string
  onChange: (iso: string) => void
  label: string
  min?: string
  max?: string
  weekStart?: 0 | 1
  /** `iso` types the year first; anything else follows the browser's region. */
  format?: 'regional' | 'iso'
  /** Where the calendar opens when nothing is picked yet. Years is the quickest route to a birth date. */
  startView?: 'days' | 'years'
  showToday?: boolean
  /** `field` is a boxed bar for forms: the whole bar opens the calendar, which floats above modals. */
  variant?: 'underline' | 'field'
  /** Id for the input, so a <label htmlFor> can point at it. */
  id?: string
  /** Shows a Clear button in the calendar. */
  clearable?: boolean
}

const Chevron = ({ flip }: { flip?: boolean }) => <Icon name="chevron" className={`size-4 ${flip ? 'rotate-180' : ''}`} />

export default function DatePicker({ value, onChange, label, min = '1900-01-01', max, weekStart = 1, format = 'regional', startView = 'days', showToday = true, variant = 'underline', id, clearable = true }: Props) {
  const boxed = variant === 'field'
  const order = useMemo(() => typingOrder(format === 'iso'), [format])
  const placeholder = order.map(p => TOKEN[p]).join('-')
  const today = useMemo(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() } }, [])
  const todayIso = toIso(today.y, today.m, today.d)
  const maxIso = max ?? todayIso
  const minP = parseIso(min), maxP = parseIso(maxIso)
  const sel = parseIso(value)

  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const kbd = useRef(false) // only pull focus into the calendar when it was opened or moved with the keyboard
  const [open, setOpen] = useState(false)
  const [side, setSide] = useState<'bottom' | 'top'>('bottom')
  const [view, setView] = useState<View>('days')
  const [dir, setDir] = useState<Dir>('zoom')
  const [cur, setCur] = useState({ y: sel?.y ?? today.y, m: sel?.m ?? today.m })
  const [focusIso, setFocusIso] = useState(value || todayIso)
  const [text, setText] = useState(fmt(value, order))
  const [error, setError] = useState('')

  // Keep the typed text in step with the stored value (picked from the calendar, cleared, or the format changed).
  useEffect(() => { setText(fmt(value, order)); setError('') }, [value, order])

  const inRange = (iso: string) => iso >= min && iso <= maxIso
  const monthInRange = (y: number, m: number) => toIso(y, m, daysIn(y, m)) >= min && toIso(y, m, 1) <= maxIso
  const yearInRange = (y: number) => monthInRange(y, 0) || monthInRange(y, 11) || (y >= (minP?.y ?? 0) && y <= (maxP?.y ?? 9999))

  const openPicker = (fromKeyboard: boolean) => {
    if (open) return
    kbd.current = fromKeyboard
    if (sel) { setCur({ y: sel.y, m: sel.m }); setView('days'); setFocusIso(value) }
    else if (startView === 'years') { setCur({ y: Math.max(minP?.y ?? 0, today.y - 20), m: 0 }); setView('years'); setFocusIso(todayIso) }
    else { setCur({ y: today.y, m: today.m }); setView('days'); setFocusIso(todayIso) }
    setDir('zoom')
    setOpen(true)
  }
  const close = (refocus = false) => { setOpen(false); kbd.current = false; if (refocus) inputRef.current?.focus() }

  // Flip above the field when there is no room below.
  useLayoutEffect(() => {
    if (!open || boxed || !wrapRef.current) return
    const r = wrapRef.current.getBoundingClientRect()
    setSide(window.innerHeight - r.bottom < 400 && r.top > 400 ? 'top' : 'bottom')
  }, [open])

  useEffect(() => {
    if (!open || boxed) return
    const away = (e: PointerEvent) => { if (!wrapRef.current?.contains(e.target as Node)) close() }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  useEffect(() => {
    if (!open || view !== 'days' || !kbd.current) return
    popRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${focusIso}"]`)?.focus()
  }, [open, view, focusIso, cur])

  const pick = (iso: string) => { onChange(iso); close(true) }

  const onType = (raw: string) => {
    const next = maskTyped(raw, text, order)
    setText(next)
    if (!next) { setError(''); if (value) onChange(''); return }
    if (next.length < placeholder.length) { setError(''); return }
    const iso = typedToIso(next, order)
    if (!iso) { setError('That is not a real date.'); return }
    if (!inRange(iso)) { setError(iso > maxIso ? (max ? 'That date is too far ahead.' : 'That date is in the future.') : 'That date is too far back.'); return }
    setError('')
    const p = parseIso(iso)!
    setCur({ y: p.y, m: p.m }); setFocusIso(iso)
    onChange(iso)
  }

  const onBlurInput = () => {
    // Anything half-typed or invalid snaps back to the saved date when you leave the field.
    window.setTimeout(() => {
      if (wrapRef.current?.contains(document.activeElement) || (document.activeElement as Element | null)?.closest?.('.dp-pop')) return
      if (text !== fmt(value, order)) { setText(fmt(value, order)); setError('') }
    }, 0)
  }

  const shift = (n: 1 | -1) => {
    setDir(n > 0 ? 'next' : 'prev')
    if (view === 'days') {
      const d = new Date(cur.y, cur.m + n, 1)
      setCur({ y: d.getFullYear(), m: d.getMonth() })
    } else setCur(c => ({ ...c, y: c.y + (view === 'years' ? 12 : 1) * n }))
  }
  const go = (v: View) => { setDir('zoom'); setView(v) }

  const pageStart = Math.floor(cur.y / 12) * 12
  const canPrev = view === 'days' ? monthInRange(new Date(cur.y, cur.m - 1, 1).getFullYear(), ((cur.m + 11) % 12)) : view === 'months' ? yearInRange(cur.y - 1) : yearInRange(pageStart - 1)
  const canNext = view === 'days' ? monthInRange(new Date(cur.y, cur.m + 1, 1).getFullYear(), ((cur.m + 1) % 12)) : view === 'months' ? yearInRange(cur.y + 1) : yearInRange(pageStart + 12)

  const monthName = (m: number, style: 'long' | 'short') => new Intl.DateTimeFormat(undefined, { month: style }).format(new Date(2001, m, 1))
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(2001, 0, 7 + ((weekStart + i) % 7)))) // 7 Jan 2001 was a Sunday
  const lead = (new Date(cur.y, cur.m, 1).getDay() - weekStart + 7) % 7
  const count = daysIn(cur.y, cur.m)
  const tabIso = parseIso(focusIso)?.y === cur.y && parseIso(focusIso)?.m === cur.m ? focusIso : toIso(cur.y, cur.m, 1)

  const onGridKey = (e: KeyboardEvent) => {
    const f = parseIso(focusIso) ?? { y: cur.y, m: cur.m, d: 1 }
    const dt = new Date(f.y, f.m, f.d)
    if (e.key === 'ArrowLeft') dt.setDate(dt.getDate() - 1)
    else if (e.key === 'ArrowRight') dt.setDate(dt.getDate() + 1)
    else if (e.key === 'ArrowUp') dt.setDate(dt.getDate() - 7)
    else if (e.key === 'ArrowDown') dt.setDate(dt.getDate() + 7)
    else if (e.key === 'PageUp') dt.setMonth(dt.getMonth() - (e.shiftKey ? 12 : 1))
    else if (e.key === 'PageDown') dt.setMonth(dt.getMonth() + (e.shiftKey ? 12 : 1))
    else return
    e.preventDefault()
    let iso = toIso(dt.getFullYear(), dt.getMonth(), dt.getDate())
    if (iso < min) iso = min
    if (iso > maxIso) iso = maxIso
    const p = parseIso(iso)!
    kbd.current = true
    setDir(p.y * 12 + p.m > cur.y * 12 + cur.m ? 'next' : p.y * 12 + p.m < cur.y * 12 + cur.m ? 'prev' : dir)
    setCur({ y: p.y, m: p.m }); setFocusIso(iso)
  }

  const onWrapKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) { e.stopPropagation(); close(true) }
  }

  const bodyKey = `${view}-${view === 'years' ? pageStart : view === 'months' ? cur.y : `${cur.y}-${cur.m}`}`

  const shell = (kids: ReactNode) => (boxed
    ? <FieldPopover anchor={wrapRef} popRef={popRef} label={`${label} calendar`} onClose={() => close()}>{kids}</FieldPopover>
    : <div ref={popRef} className="dp-pop" data-side={side} role="dialog" aria-label={`${label} calendar`}>{kids}</div>)

  return (
    <div ref={wrapRef} className="dp" data-variant={variant} onKeyDown={onWrapKey}>
      <div className="dp-field" data-open={open} data-error={!!error}
        onClick={e => { const t = e.target as HTMLElement; if (t === inputRef.current || t.closest('.dp-open')) return; inputRef.current?.focus(); openPicker(false) }}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={label}
          aria-invalid={!!error}
          aria-describedby={error ? 'dp-error' : undefined}
          placeholder={placeholder}
          value={text}
          onChange={e => onType(e.target.value)}
          onFocus={() => openPicker(false)}
          onClick={() => openPicker(false)}
          onBlur={onBlurInput}
          onKeyDown={e => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); openPicker(true) } }}
        />
        <button type="button" className="dp-open" aria-label={open ? 'Close calendar' : 'Open calendar'} aria-expanded={open} onClick={() => (open ? close() : openPicker(true))}>
          <Icon name="calendar" className="size-[18px]" />
        </button>
      </div>
      {error && <p id="dp-error" role="alert" className="dp-error">{error}</p>}

      {open && shell(
        <>
          <div className="dp-head">
            <div className="dp-title">
              {view === 'days' && <>
                <button type="button" onClick={() => go('months')}>{monthName(cur.m, 'long')}</button>
                <button type="button" onClick={() => go('years')}>{cur.y}</button>
              </>}
              {view === 'months' && <button type="button" onClick={() => go('years')}>{cur.y}</button>}
              {view === 'years' && <span>{pageStart} – {pageStart + 11}</span>}
            </div>
            <div className="dp-nav">
              <button type="button" onClick={() => shift(-1)} disabled={!canPrev} aria-label="Previous"><Chevron flip /></button>
              <button type="button" onClick={() => shift(1)} disabled={!canNext} aria-label="Next"><Chevron /></button>
            </div>
          </div>

          <div key={bodyKey} className="dp-body" data-dir={dir}>
            {view === 'days' && (
              <>
                <div className="dp-week" aria-hidden="true">{weekdays.map((w, i) => <span key={i}>{w}</span>)}</div>
                <div className="dp-grid" role="grid" aria-label={`${monthName(cur.m, 'long')} ${cur.y}`} onKeyDown={onGridKey}>
                  {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
                  {Array.from({ length: count }, (_, i) => {
                    const d = i + 1
                    const iso = toIso(cur.y, cur.m, d)
                    const off = !inRange(iso)
                    const full = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(cur.y, cur.m, d))
                    return (
                      <button key={d} type="button" className="dp-day" data-iso={iso} data-sel={value === iso} data-today={iso === todayIso} disabled={off}
                        tabIndex={iso === tabIso ? 0 : -1} aria-label={full} aria-pressed={value === iso} onClick={() => pick(iso)}>{d}</button>
                    )
                  })}
                </div>
              </>
            )}
            {view === 'months' && (
              <div className="dp-cells">
                {Array.from({ length: 12 }, (_, m) => (
                  <button key={m} type="button" className="dp-cell" data-sel={sel?.y === cur.y && sel.m === m} data-today={today.y === cur.y && today.m === m}
                    disabled={!monthInRange(cur.y, m)} onClick={() => { setCur(c => ({ ...c, m })); setFocusIso(toIso(cur.y, m, Math.min(parseIso(focusIso)?.d ?? 1, daysIn(cur.y, m)))); go('days') }}>{monthName(m, 'short')}</button>
                ))}
              </div>
            )}
            {view === 'years' && (
              <div className="dp-cells">
                {Array.from({ length: 12 }, (_, i) => {
                  const y = pageStart + i
                  return (
                    <button key={y} type="button" className="dp-cell" data-sel={sel?.y === y} data-today={today.y === y} disabled={!yearInRange(y)}
                      onClick={() => { setCur(c => ({ ...c, y })); go('months') }}>{y}</button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="dp-foot">
            {clearable ? <button type="button" disabled={!value} onClick={() => { onChange(''); close(true) }}>Clear</button> : <span />}
            {showToday && inRange(todayIso) && <button type="button" onClick={() => pick(todayIso)}>Today</button>}
          </div>
        </>
      )}
    </div>
  )
}
