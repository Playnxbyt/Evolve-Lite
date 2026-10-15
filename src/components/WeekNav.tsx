import { useEffect, useState, type KeyboardEvent } from 'react'
import { Icon } from './Icons'

export type WeekDir = 'next' | 'prev'

/**
 * Which week a card is showing, as an offset from the current week (0 = this week, -1 = last week, ...).
 * `dir` remembers the direction of travel so content can slide the way you are moving.
 * Going forward stops at the current week; going back stops at `minOffset` (the week you started).
 */
export function useWeekNav(minOffset: number) {
  const [view, setView] = useState<{ offset: number; dir: WeekDir }>({ offset: 0, dir: 'next' })
  const go = (to: number) =>
    setView(v => {
      const n = Math.max(Math.min(minOffset, 0), Math.min(0, to))
      return n === v.offset ? v : { offset: n, dir: n > v.offset ? 'next' : 'prev' }
    })
  const offset = Math.max(Math.min(minOffset, 0), view.offset)
  return {
    offset,
    dir: view.dir,
    go,
    prev: () => go(offset - 1),
    next: () => go(offset + 1),
    reset: () => go(0),
    canPrev: offset > minOffset,
    canNext: offset < 0,
  }
}

const short = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/** "12 – 18 Oct", or "29 Sep – 5 Oct" when the week crosses a month. */
export function weekRangeLabel(start: Date) {
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()} – ${short(end)}`
    : `${short(start)} – ${short(end)}`
}

/** "This week", "Last week", "3 weeks ago". */
export function weekRelative(offset: number) {
  return offset === 0 ? 'This week' : offset === -1 ? 'Last week' : `${-offset} weeks ago`
}

/**
 * Text that glides out the way you are going while the new text glides in,
 * rather than snapping. Both layers share one grid cell so the width never jumps.
 */
export function SlideText({ text, dir, className }: { text: string; dir: WeekDir; className?: string }) {
  const [s, setS] = useState({ cur: text, prev: null as string | null, n: 0 })
  useEffect(() => {
    setS(v => (v.cur === text ? v : { cur: text, prev: v.cur, n: v.n + 1 }))
  }, [text])
  useEffect(() => {
    if (s.prev === null) return
    const t = window.setTimeout(() => setS(v => ({ ...v, prev: null })), 480)
    return () => window.clearTimeout(t)
  }, [s.n, s.prev])
  return (
    <span className={`wk-stack ${className ?? ''}`}>
      {s.prev !== null && <span key={`p${s.n}`} aria-hidden="true" className={`wk-out-${dir}`}>{s.prev}</span>}
      <span key={`c${s.n}`} className={s.n ? `wk-in-${dir}` : undefined}>{s.cur}</span>
    </span>
  )
}

interface Props {
  offset: number
  dir: WeekDir
  label: string
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
  onReset: () => void
  className?: string
  showReset?: boolean
}

/** "This week" shortcut, shown only once you have moved away. Kept separate from the pill so the pill never moves. */
export function WeekReset({ offset, onReset, className }: { offset: number; onReset: () => void; className?: string }) {
  if (offset === 0) return null
  return (
    <button type="button" onClick={onReset}
      className={`wk-reset shrink-0 rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-xs text-teal transition-[background-color,transform] duration-200 hover:bg-teal/20 active:scale-95 ${className ?? ''}`}>
      {offset === -1 ? 'This week' : 'Back to this week'}
    </button>
  )
}

/**
 * Previous / next week pill with a fixed-width range label so it never resizes or shifts.
 * With `showReset`, the "This week" shortcut sits at the far end of the row, away from the pill.
 */
export default function WeekNav({ offset, dir, label, canPrev, canNext, onPrev, onNext, onReset, className, showReset }: Props) {
  const key = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && canPrev) { e.preventDefault(); onPrev() }
    if (e.key === 'ArrowRight' && canNext) { e.preventDefault(); onNext() }
  }
  const btn = 'wk-btn grid size-7 place-items-center rounded-full text-ink/70 transition-[background-color,color,transform,opacity] duration-200 hover:bg-white/10 hover:text-ink active:scale-90 disabled:pointer-events-none disabled:opacity-25 focus-visible:outline-2 focus-visible:outline-teal/60'
  return (
    <div className={`flex items-center justify-between gap-2 ${className ?? ''}`}>
      <div role="group" aria-label="Choose week" onKeyDown={key}
        className="inline-flex shrink-0 items-center rounded-full border border-white/10 bg-white/[0.05] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
        <button type="button" aria-label="Previous week" disabled={!canPrev} onClick={onPrev} className={btn}>
          <Icon name="chevron" className="size-4 rotate-180" />
        </button>
        <span aria-live="polite" className="wk-label w-[8.25rem] px-1 text-center text-xs tabular-nums text-ink/80">
          <SlideText text={label} dir={dir} />
        </span>
        <button type="button" aria-label="Next week" disabled={!canNext} onClick={onNext} className={btn}>
          <Icon name="chevron" className="size-4" />
        </button>
      </div>
      {showReset && <WeekReset offset={offset} onReset={onReset} />}
    </div>
  )
}
