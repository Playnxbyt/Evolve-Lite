import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CATS, PRIORITY_RANK, catById, habitDone, habitStreak, streak, tasksOn, type AppState, type HabitFields, type Task } from '../lib/core'
import {
  bestFullDayRun, bestRun, buildStat, daysOfMonth, daysOfWeek, isHabit, percent, strongestWeekday, sum,
  type CellState, type HabitStat,
} from '../lib/habitStats'
import CategorySelect, { type CategoryOption } from './CategorySelect'
import HabitModal from './HabitModal'
import { Icon } from './Icons'
import LiveScene from './LiveScene'
import { weekStartIndex } from '../lib/preferences'
import TopBar from './TopBar'

interface Props {
  state: AppState
  onAdd: (fields: HabitFields) => void
  onUpdate: (id: string, fields: HabitFields) => void
  onRemove: (id: string) => void
  /** Checks or unchecks a habit for today. */
  onToggle: (id: string) => void
}

const FILTERS = [['all', 'All'], ['today', 'Today'], ['completed', 'Completed'], ['missed', 'Missed']] as const
type Filter = (typeof FILTERS)[number][0]

const LETTERS = weekStartIndex() === 0 ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const NAMES = weekStartIndex() === 0 ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']
const CELL_WORD: Record<CellState, string> = {
  done: 'done', missed: 'missed', pending: 'not done yet', upcoming: 'upcoming', rest: 'not scheduled', before: 'before you started',
}
const TARGET = 0.8
const RING_R = 40
const CIRC = 2 * Math.PI * RING_R
const COLS = 'sm:grid-cols-[2.5rem_minmax(0,1fr)_15.75rem_6rem_2.25rem]'
const eyebrow = 'text-[11px] font-medium uppercase tracking-[0.18em]'
const toMin = (t?: string) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null)
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
const delay = (n: number) => ({ animationDelay: `${n * 90}ms` })
const shortDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/** Today's completion toggle. The ring burst only plays at the moment of checking, not when a done habit first renders. */
function CheckButton({ checked, disabled, label, onClick }: { checked: boolean; disabled: boolean; label: string; onClick: () => void }) {
  const [pop, setPop] = useState(false)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (!checked) { setPop(false); return }
    setPop(true)
    const t = window.setTimeout(() => setPop(false), 1000)
    return () => window.clearTimeout(t)
  }, [checked])
  return (
    <button type="button" aria-pressed={checked} aria-label={label} disabled={disabled} data-pop={pop} onClick={onClick} className="hb-check">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
      </svg>
    </button>
  )
}


interface RowProps {
  h: HabitStat
  open: boolean
  ready: boolean
  monthLead: number
  onToggle: () => void
  onOpen: () => void
  onEdit: () => void
  onRemove: () => void
  best: number
}

/** One habit: today's check, the week trail and, when expanded, the whole month. */
function HabitRow({ h, open, ready, monthLead, onToggle, onOpen, onEdit, onRemove, best }: RowProps) {
  const c = catById(h.t.catId)
  const stat = 'text-lg font-light tabular-nums'
  return (
    <li style={{ '--c': c.color } as CSSProperties}
      className={`hb-row grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 px-5 py-3.5 transition-colors ${open ? 'bg-white/[0.03]' : ''} ${COLS}`}>
      <span className="sm:col-start-1 sm:row-start-1">
        <CheckButton checked={h.today === 'done'} disabled={h.today === 'rest'}
          label={h.today === 'rest' ? `${h.t.text} is not scheduled today` : `Mark ${h.t.text} done today`} onClick={onToggle} />
      </span>

      <div className="flex min-w-0 items-center gap-3 sm:col-start-2 sm:row-start-1">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${c.color}1F`, color: c.color }}>
          <Icon name={c.icon} className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <p className={`truncate text-[15px] transition-colors duration-300 ${h.today === 'done' ? 'text-ink/50' : ''}`}>{h.t.text}</p>
          <p className="flex items-center gap-2 truncate text-xs text-ink/60">
            <span className="truncate">{c.label}{h.t.time ? ` · ${h.t.time}` : ''}{h.t.duration ? ` · ${h.t.duration} min` : ''}</span>
            {h.run > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 text-orange-300/90" title={`${plural(h.run, 'day')} in a row`}>
                <Icon name="flame" className="size-3" />{h.run}d
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:contents">
        <div className="w-20 sm:col-start-4 sm:row-start-1 sm:w-auto" title={`${h.w.done} of ${h.w.possible} check-ins this week`}>
          <p className="flex items-baseline justify-between text-sm tabular-nums">
            <span><span className="font-semibold">{h.w.done}</span><span className="text-ink/50"> / {h.w.possible}</span></span>
            <span className="text-xs text-ink/60">{percent(h.w)}%</span>
          </p>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/15">
            <div className="hb-w h-full rounded-full" style={{ width: ready ? `${percent(h.w)}%` : '0%', background: `linear-gradient(90deg, ${c.color}, #3b8cff)` }} />
          </div>
        </div>
        <button type="button" aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} details for ${h.t.text}`} onClick={onOpen}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-ink/55 transition-colors hover:bg-white/[0.06] hover:text-ink sm:col-start-5 sm:row-start-1">
          <Icon name="chevron" className={`size-4 transition-transform duration-300 ${open ? '-rotate-90' : 'rotate-90'}`} />
        </button>
      </div>

      <div role="img" aria-label={`${h.t.text} this week: ${h.week.map((cl, i) => `${NAMES[i]} ${CELL_WORD[cl.state]}`).join(', ')}`}
        className="col-span-2 col-start-2 sm:col-span-1 sm:col-start-3 sm:row-start-1">
        <div className="grid grid-cols-7">
          {h.week.map((cl, i) => (
            <span key={i} className="hb-cell" data-link={cl.state === 'done' && i > 0 && h.week[i - 1].state === 'done'}>
              <span className="hb-dot" data-s={cl.state} data-today={cl.today}>
                {cl.state === 'done' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} /></svg>}
              </span>
            </span>
          ))}
        </div>
        <div aria-hidden="true" className="grid grid-cols-7 text-center text-[10px] sm:hidden">
          {LETTERS.map((l, i) => <span key={i} className={h.week[i].today ? 'font-semibold text-teal' : 'text-ink/40'}>{l}</span>)}
        </div>
      </div>

      <div className={`col-span-full grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="flex flex-wrap items-start gap-x-10 gap-y-5 border-t border-white/10 pt-4 sm:pl-[3.25rem]">
            <div>
              <p className="mb-2 text-[11px] text-ink/50">{h.month[0].date.toLocaleDateString('en-US', { month: 'long' })} · {h.month.length} days</p>
              <div className="grid w-[15.5rem] grid-cols-7 gap-1" role="img" aria-label={`${h.m.done} of ${h.m.possible} check-ins this month`}>
                {LETTERS.map((l, i) => <span key={i} aria-hidden="true" className="text-center text-[10px] text-ink/40">{l}</span>)}
                {Array.from({ length: monthLead }, (_, i) => <span key={`b${i}`} />)}
                {h.month.map(cl => (
                  <span key={cl.date.getDate()} className="hb-day" data-s={cl.state} data-today={cl.today}
                    title={`${shortDate(cl.date)}: ${CELL_WORD[cl.state]}`}>{cl.date.getDate()}</span>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-5">
              <dl className="flex gap-8">
                <div><dt className="text-[11px] text-ink/50">Current streak</dt><dd className={stat}>{h.run}<span className="text-xs text-ink/50"> d</span></dd></div>
                <div><dt className="text-[11px] text-ink/50">Best streak</dt><dd className={stat}>{best}<span className="text-xs text-ink/50"> d</span></dd></div>
                <div>
                  <dt className="text-[11px] text-ink/50">This month</dt>
                  <dd className={stat}>{percent(h.m)}<span className="text-xs text-ink/50">%</span></dd>
                  <dd className="text-[11px] tabular-nums text-ink/50">{h.m.done} of {h.m.possible} days</dd>
                </div>
              </dl>
              <div className="flex gap-2">
                <button type="button" onClick={onEdit} className="rounded-lg border border-white/10 px-3.5 py-2 text-sm transition-colors hover:border-teal/40 hover:text-teal">Edit</button>
                <button type="button" onClick={onRemove}
                  className="rounded-lg border border-white/10 px-3.5 py-2 text-sm text-ink/70 transition-colors hover:border-red-400/40 hover:text-red-400">Delete</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}

export default function Habits({ state, onAdd, onUpdate, onRemove, onToggle }: Props) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(i) }, [])
  const [ready, setReady] = useState(false) // lets rings and bars grow in from empty on first paint
  useEffect(() => { const r = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(r) }, [])
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')

  const todayIdx = (now.getDay() - weekStartIndex() + 7) % 7
  const week = daysOfWeek(now)
  const month = daysOfMonth(now)
  const monthLead = (month[0].getDay() - weekStartIndex() + 7) % 7
  const confirmRemove = (id: string) => { if (confirm('Delete this habit from today onward?')) onRemove(id) }

  const habits = state.tasks.filter(isHabit).map(t => buildStat(state, t, week, month, now, habitStreak(state, t, now)))
  const cats = CATS.map(c => c.id).filter(id => habits.some(h => h.t.catId === id))
  const active = cats.some(id => id === cat) ? cat : 'all'

  // Summaries follow the category and search, never the status filter, so they stay comparable.
  const scoped = habits
    .filter(h => active === 'all' || h.t.catId === active)
    .filter(h => !q.trim() || h.t.text.toLowerCase().includes(q.trim().toLowerCase()))
  const visible = scoped
    .filter(h => filter === 'all' || (filter === 'today' && h.today !== 'rest') || (filter === 'completed' && h.today === 'done') || (filter === 'missed' && h.w.missed > 0))
    .sort((a, b) => (toMin(a.t.time) ?? 1e4) - (toMin(b.t.time) ?? 1e4) || PRIORITY_RANK[a.t.priority] - PRIORITY_RANK[b.t.priority])
  const dueToday = visible.filter(h => h.today !== 'rest')
  const later = visible.filter(h => h.today === 'rest')
  const todayDone = dueToday.filter(h => h.today === 'done').length

  const weekT = sum(scoped.map(h => h.w))
  const monthT = sum(scoped.map(h => h.m))
  const weekPct = percent(weekT)
  const monthPct = percent(monthT)
  const perDay = week.map((_, i) => sum(scoped.map(h => ({ done: +(h.week[i].state === 'done'), possible: +(h.week[i].state !== 'rest'), missed: +(h.week[i].state === 'missed') }))))

  const overall = streak(state)
  const bestOverall = Math.max(overall, bestFullDayRun(state, now))
  const monthDays = month.map(d => {
    const ts = tasksOn(state, d), n = ts.filter(t => habitDone(state, t, d)).length
    const s = d > now ? 'future' : !ts.length ? 'none' : n === ts.length ? 'full' : n > 0 ? 'part' : 'miss'
    return { d, s, n, of: ts.length }
  })

  // Insights, all derived from the same tallies.
  const strong = strongestWeekday(state, scoped.map(h => h.t), now)
  const need = Math.ceil(weekT.possible * TARGET) - weekT.done
  const reachable = scoped.reduce((n, h) => n + h.week.filter(c => c.state === 'pending' || c.state === 'upcoming').length, 0)
  const slip = [...scoped].sort((a, b) => b.w.missed - a.w.missed)[0]
  const top = [...scoped].filter(h => h.m.done > 0).sort((a, b) => percent(b.m) - percent(a.m))[0]
  const lines = [
    weekT.possible === 0 ? null
      : need <= 0 ? `You have passed the ${TARGET * 100}% target for this week.`
      : need > reachable ? `${TARGET * 100}% is out of reach this week, but every check-in still counts.`
      : `${plural(need, 'more check-in')} to reach ${TARGET * 100}% this week.`,
    monthT.possible ? `${monthT.done} of ${monthT.possible} check-ins done this ${now.toLocaleDateString('en-US', { month: 'long' })}.` : null,
    slip && slip.w.missed > 0 ? `${slip.t.text} slipped ${plural(slip.w.missed, 'day')} this week.` : scoped.length > 1 ? 'No missed days this week so far.' : null,
    top ? `Strongest habit this month: ${top.t.text} at ${percent(top.m)}%.` : null,
  ].filter((l): l is string => !!l)

  const row = (h: HabitStat) => (
    <HabitRow key={h.t.id} h={h} open={openId === h.t.id} ready={ready} monthLead={monthLead} best={bestRun(state, h.t, now)}
      onToggle={() => onToggle(h.t.id)} onOpen={() => setOpenId(openId === h.t.id ? null : h.t.id)} onEdit={() => setEditing(h.t)} onRemove={() => confirmRemove(h.t.id)} />
  )
  const header = (
    <div aria-hidden="true" className="hidden gap-x-3 px-5 pb-1 text-[11px] sm:grid sm:grid-cols-[2.5rem_minmax(0,1fr)_15.75rem_6rem_2.25rem]">
      <span className="col-start-3 grid grid-cols-7 text-center">
        {LETTERS.map((l, i) => <span key={i} className={i === todayIdx ? 'font-semibold text-teal' : 'text-ink/45'}>{l}</span>)}
      </span>
      <span className="text-ink/45">This week</span>
    </div>
  )
  const catOptions: CategoryOption[] = [
    { id: 'all', label: 'All categories', count: habits.length },
    ...cats.map(id => { const c = catById(id); return { id, label: c.label, color: c.color, icon: c.icon, count: habits.filter(h => h.t.catId === id).length } }),
  ]


  return (
    <div className="hb-cards">
      <TopBar name={state.name}>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Habits</h1>
          <p className="mt-1 text-sm text-ink/60">Build consistency, one day at a time.</p>
        </div>
      </TopBar>

      <div className="fade-up relative z-30 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          <div role="group" aria-label="Filter habits" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-1">
            {FILTERS.map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className="hb-pill">{label}</button>)}
          </div>
          <CategorySelect value={active} options={catOptions} onChange={setCat} />
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <label className="relative min-w-0 flex-1 sm:w-52 sm:flex-none">
            <span className="sr-only">Search habits</span>
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/50" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search habits"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-sm placeholder:text-ink/45 focus:border-teal/50" />
          </label>
          <button type="button" onClick={() => setAdding(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-teal px-3.5 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90">
            <Icon name="plus" className="size-4" />Add habit
          </button>
        </div>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="glass fade-up rounded-2xl pb-2 pt-5" style={delay(1)}>
            <div className="mb-3 flex items-baseline justify-between px-5">
              <h2 className={`${eyebrow} text-ink/70`}>Current habits <span className="ml-2 normal-case tracking-normal text-ink/50">{now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span></h2>
              <span className="text-xs tabular-nums text-ink/60">{todayDone} / {dueToday.length} completed</span>
            </div>
            {visible.length === 0 ? (
              <div className="px-5 pb-6 pt-2">
                <p className="text-sm text-ink/70">
                  {habits.length === 0 ? 'No habits yet. Add one and its week and month will show up here.' : 'No habits match these filters.'}
                </p>
                {habits.length === 0 && <button type="button" onClick={() => setAdding(true)} className="mt-4 rounded-lg border border-white/10 px-3.5 py-2 text-sm transition-colors hover:border-teal/40 hover:text-teal">Add your first habit</button>}
              </div>
            ) : (
              <>
                {dueToday.length > 0 ? <>{header}<ul className="divide-y divide-white/10">{dueToday.map(row)}</ul></> : <p className="px-5 pb-4 text-sm text-ink/60">Nothing in this view is scheduled today.</p>}
                {later.length > 0 && (
                  <>
                    <h3 className={`${eyebrow} mb-1 mt-5 border-t border-white/10 px-5 pt-4 text-ink/50`}>Not scheduled today</h3>
                    <ul className="divide-y divide-white/10">{later.map(row)}</ul>
                  </>
                )}
              </>
            )}
          </section>

          <section className="glass fade-up rounded-2xl p-5 sm:p-6" style={delay(2)}>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className={`${eyebrow} text-ink/70`}>This week</h2>
              <span className="text-xs text-ink/60">{shortDate(week[0])} – {shortDate(week[6])}</span>
            </div>
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:gap-8">
              <div>
                <p className="text-xs text-ink/60">Overall habit completion</p>
                <p className="mt-1 text-4xl font-light tabular-nums tracking-tight">{weekPct}<span className="text-xl text-ink/50">%</span></p>
                <div className="relative mt-3 h-1.5 rounded-full bg-white/10">
                  <div className="hb-w h-full rounded-full bg-gradient-to-r from-mint to-blue" style={{ width: ready ? `${weekPct}%` : '0%' }} />
                  <span aria-hidden="true" title={`${TARGET * 100}% target`} className="absolute -top-1 h-3.5 w-px bg-white/50" style={{ left: `${TARGET * 100}%` }} />
                </div>
                <p className="mt-2 text-xs tabular-nums text-ink/55">{weekT.done} / {weekT.possible} check-ins</p>
                <div className="mt-5 grid grid-cols-7 text-center">
                  {perDay.map((p, i) => {
                    const full = p.possible > 0 && p.done === p.possible
                    const future = i > todayIdx
                    return (
                      <div key={i} className="flex flex-col items-center gap-1.5" title={p.possible ? `${NAMES[i]}: ${p.done} of ${p.possible}` : `${NAMES[i]}: nothing scheduled`}>
                        <span className={`text-[11px] ${i === todayIdx ? 'text-ink' : 'text-ink/55'}`}>{NAMES[i]}</span>
                        <span className={`grid size-6 place-items-center rounded-full border text-[10px] tabular-nums transition-colors ${
                          full ? 'border-teal bg-teal text-bg' : p.done > 0 ? 'border-teal/60 text-teal' : future || !p.possible ? 'border-dashed border-white/20 text-ink/40' : 'border-red-400/40 text-red-300/70'}`}>
                          {full ? <Icon name="check" className="size-3" /> : p.possible ? p.done : '–'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs text-ink/60">Check-ins this week</p>
                {scoped.length === 0 && <p className="text-sm text-ink/60">No habits to compare yet.</p>}
                {scoped.length > 0 && (
                  <div aria-hidden="true" className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px]">
                    {LETTERS.map((l, i) => <span key={i} className={i === todayIdx ? 'font-semibold text-teal' : 'text-ink/40'}>{l}</span>)}
                  </div>
                )}
                <ul className="space-y-3">
                  {[...scoped].sort((a, b) => percent(b.w) - percent(a.w)).map(h => (
                    <li key={h.t.id} style={{ '--c': catById(h.t.catId).color } as CSSProperties}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate">{h.t.text}</span>
                        <span className="shrink-0 text-xs tabular-nums text-ink/60">{h.w.done} / {h.w.possible}</span>
                      </div>
                      {/* One segment per weekday, Monday to Sunday, so a check-in lands under the day it was made. */}
                      <div className="mt-1.5 grid grid-cols-7 gap-1" role="img"
                        aria-label={`${h.t.text} this week: ${h.week.map((cl, i) => `${NAMES[i]} ${CELL_WORD[cl.state]}`).join(', ')}`}>
                        {h.week.map((cl, i) => cl.state === 'rest'
                          ? <span key={i} /> // not scheduled that day: leave the slot empty so the other bars stay under their weekday
                          : <span key={i} className="hb-seg" data-s={cl.state} data-on={cl.state === 'done'} data-today={cl.today} title={`${NAMES[i]}: ${CELL_WORD[cl.state]}`} />)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="fade-up relative overflow-hidden rounded-2xl border border-white/10" style={delay(2)}>
            <LiveScene theme="twilight" />
            <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,10,20,0.78),rgba(6,10,20,0.2)_80%)]" />
            <div className="relative p-6">
              <p className={`${eyebrow} text-ink/70`}>Current streak</p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <p className="flex items-center gap-2 text-5xl font-light tabular-nums">
                  <Icon name="flame" className={`size-7 text-orange-400 ${overall > 0 ? 'flame' : 'opacity-60'}`} />{overall}
                  <span className="pb-1.5 text-lg text-ink/70">{overall === 1 ? 'day' : 'days'}</span>
                </p>
                <p className="rounded-lg border border-white/10 bg-bg/50 px-3 py-1.5 text-right text-xs text-ink/70">Best streak<br /><span className="text-base tabular-nums text-ink">{bestOverall}</span> {bestOverall === 1 ? 'day' : 'days'}</p>
              </div>
              <div className="mt-4 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${month.length}, minmax(0, 1fr))` }} role="img"
                aria-label={`${monthDays.filter(d => d.s === 'full').length} complete days so far in ${now.toLocaleDateString('en-US', { month: 'long' })}`}>
                {monthDays.map(d => (
                  <span key={d.d.getDate()} title={d.of ? `${shortDate(d.d)}: ${d.n} of ${d.of}` : `${shortDate(d.d)}: nothing scheduled`} data-s={d.s} className="hb-seg-day" />
                ))}
              </div>
              <p className="mt-3 text-xs text-ink/65">Consistency turns effort into results.</p>
            </div>
          </section>

          <section className="glass fade-up rounded-2xl p-5 sm:p-6" style={delay(3)}>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className={`${eyebrow} text-ink/70`}>This month</h2>
              <span className="text-xs text-ink/60">{now.toLocaleDateString('en-US', { month: 'long' })} · {month.length} days</span>
            </div>
            <div className="flex items-center gap-5">
              <div className="relative size-24 shrink-0">
                <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={`${monthPct}% of this month's check-ins done`}>
                  <circle cx="50" cy="50" r={RING_R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9" />
                  <circle cx="50" cy="50" r={RING_R} fill="none" stroke="url(#hb-grad)" strokeWidth="9" strokeLinecap="round" className="hb-ring"
                    strokeDasharray={CIRC} strokeDashoffset={ready ? CIRC - (monthPct / 100) * CIRC : CIRC} />
                  <defs><linearGradient id="hb-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#3ddc97" /><stop offset="100%" stopColor="#3b8cff" /></linearGradient></defs>
                </svg>
                <span className="absolute inset-0 grid place-items-center text-xl font-medium tabular-nums">{monthPct}%</span>
              </div>
              <dl className="min-w-0 flex-1 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-ink/60">Check-ins done</dt><dd className="tabular-nums">{monthT.done} of {monthT.possible}</dd></div>
                <div className="flex justify-between"><dt className="text-ink/60">Active habits</dt><dd className="tabular-nums">{scoped.length}</dd></div>
              </dl>
            </div>
          </section>

          <section className="glass fade-up rounded-2xl p-5 sm:p-6" style={delay(4)}>
            <h2 className={`${eyebrow} mb-4 text-ink/70`}>Insights</h2>
            <div className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lifestyle/10 text-lifestyle"><Icon name="bulb" className="size-5" /></span>
              <div>
                <p className="font-medium leading-snug">{strong ? `You're most consistent on ${WEEKDAYS[strong.weekday]}.` : 'Patterns appear after a couple of weeks.'}</p>
                <p className="mt-1 text-sm text-ink/60">{strong ? `${strong.pct}% of scheduled check-ins done on ${WEEKDAYS[strong.weekday]} over the last 8 weeks.` : 'Keep checking in and your strongest day will show up here.'}</p>
              </div>
            </div>
            {lines.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm text-ink/75">
                {lines.map((l, i) => <li key={i} className="flex gap-2.5"><span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-teal/70" />{l}</li>)}
              </ul>
            )}
          </section>
        </div>
      </div>

      {adding && <HabitModal oneOff={false} onSubmit={onAdd} onClose={() => setAdding(false)} />}
      {editing && <HabitModal initial={editing} onSubmit={f => onUpdate(editing.id, f)} onClose={() => setEditing(null)} />}
    </div>
  )
}
