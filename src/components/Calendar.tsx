import { Fragment, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKey, type ReactNode } from 'react'
import { catById, habitDone, tasksOn, type AppState, type Task } from '../lib/core'
import { isHabit } from '../lib/habitStats'
import {
  MAX_YEAR, MIN_YEAR, REMINDERS, REPEATS, addDays, addMonths, catOf, ensureNotifyPermission, fmtRange, fmtTime, loadView, monthGrid, occurrence,
  occurrencesBetween, occursOn, parseYmd, saveView, shiftDate, toMin, weekDays, whenLabel, withYearMonth, ymd,
  type CalEvent, type CalView, type EventCat, type EventFields, type EventsApi, type Occurrence,
} from '../lib/calendarEvents'
import DatePicker from './DatePicker'
import EventModal from './EventModal'
import { Icon, type IconName } from './Icons'
import LiveScene from './LiveScene'
import Switch from './Switch'
import TopBar from './TopBar'
import { loadPreferences } from '../lib/preferences'

interface Props {
  state: AppState
  events: EventsApi
  /** Checks or unchecks a habit for today. */
  onToggle: (id: string) => void
  /** Day to open on; defaults to today. */
  startDate?: Date
}

/** One thing on a day: an event occurrence or a scheduled habit/task from the app state. */
interface Item {
  key: string
  title: string
  sub: string
  color: string
  icon: IconName
  /** Minutes from midnight. */
  start: number
  end: number
  timed: boolean
  occ?: Occurrence
  task?: Task
  done?: boolean
}
interface ModalState { event?: CalEvent; occDate?: string; date: string; time?: string }
type Tone = 'live' | 'done' | 'soon' | 'late' | 'past' | 'plain'

const HOUR = 48
/** Accent for month-view days whose events have all happened. */
const HAPPENED = '#3ddc97'
const DOW = loadPreferences().startOfWeek === 'sunday' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = Array.from({ length: 12 }, (_, m) => new Date(2000, m, 1).toLocaleDateString('en-US', { month: 'long' }))
const VIEWS: { id: CalView; label: string }[] = [{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }]
const EVENT_ICON: Record<EventCat, IconName> = { personal: 'leaf', deadline: 'clock', professional: 'briefcase', social: 'profile', important: 'flame' }
const QUOTES = [
  'Discipline today, freedom tomorrow.', 'Small steps every day lead to big results.', 'Show up, even when it is small.',
  'You do not need a perfect day. You need a started one.', 'Consistency is quiet, and it compounds.', 'Better choices, bigger tomorrow.',
]
const TONE: Record<Tone, string> = {
  live: 'bg-blue/15 text-blue', done: 'bg-teal/15 text-teal', soon: 'bg-lifestyle/15 text-lifestyle',
  late: 'bg-red-400/10 text-red-300', past: 'bg-white/[0.05] text-ink/45', plain: 'bg-white/[0.06] text-ink/60',
}

const eyebrow = 'text-[11px] font-medium uppercase tracking-[0.18em]'
const mid = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
const longDay = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const fmtDur = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`)
const shortRem = (m: number) => (m === 0 ? 'At start' : m < 60 ? `${m} min` : m < 1440 ? `${m / 60} h` : `${m / 1440} d`)
const iconBtn = 'grid size-9 shrink-0 place-items-center rounded-lg text-ink/70 transition-colors hover:bg-white/[0.07] hover:text-ink'
const ghostBtn = 'rounded-lg border border-white/10 px-3.5 py-2 text-sm transition-colors hover:border-teal/40 hover:text-teal'

const step = (n: number) => ({ '--i': n }) as CSSProperties
const dayDiff = (date: string, today: Date) => Math.round((parseYmd(date).getTime() - today.getTime()) / 86400000)
const evStyle = (color: string, live: boolean): CSSProperties => ({
  backgroundColor: `${color}${live ? '26' : '14'}`,
  boxShadow: `inset 0 0 0 1px ${color}${live ? '66' : '3d'}, inset 3px 0 0 ${color}`,
})

/** The line under "Heads up" in the bottom banner: what is next, and one useful nudge for it. */
const TITLE_TIPS: [RegExp, string][] = [
  [/present|pitch|demo|viva|seminar|speech/i, 'Make sure you practice it out loud at least once.'],
  [/interview/i, 'Rehearse your answers and read up on who you are meeting.'],
  [/exam|test|quiz/i, 'Go over the key topics and get a good night’s sleep.'],
  [/submit|submission|assignment|report/i, 'Aim to finish early so there is time to check your work.'],
]
const CAT_TIPS: Record<EventCat, string> = {
  personal: 'Make room for it. You planned it for a reason.',
  deadline: 'Aim to finish early so there is time to check your work.',
  professional: 'Jot down your points beforehand so you walk in prepared.',
  social: 'Leave a little buffer so you can arrive relaxed and enjoy it.',
  important: 'Clear the decks around it so it gets your full attention.',
}
function planNote(o: Occurrence, now: Date, today: Date) {
  const e = o.event, t = now.getTime(), n = dayDiff(o.date, today), live = o.start <= t && !e.allDay
  const name = `“${e.title}”`, at = !e.allDay && e.time ? ` at ${fmtTime(e.time)}` : ''
  const soon = !live && n <= 0 && !e.allDay && o.start - t <= 3600000
  const w = whenLabel(o.start, t)
  const head = live ? `${name} is on right now.`
    : soon ? (w === 'Starting now' ? `${name} is starting now.` : `${name} starts ${w.toLowerCase()}.`)
    : n <= 0 ? `You have ${name} today${at}.`
    : n === 1 ? `You have ${name} tomorrow${at}.`
    : n < 7 ? `You have ${name} on ${parseYmd(o.date).toLocaleDateString('en-US', { weekday: 'long' })}${at}.`
    : `You have ${name} in ${n} days.`
  const tip = live ? 'Give it your full attention.' : soon ? 'Take a minute to get ready.' : TITLE_TIPS.find(([re]) => re.test(e.title))?.[1] ?? CAT_TIPS[e.catId]
  return { head, tip, color: catOf(e.catId).color }
}

function itemsOn(events: CalEvent[], state: AppState, date: Date): Item[] {
  const key = ymd(date)
  const evs = events.filter(e => occursOn(e, date)).map((e): Item => {
    const o = occurrence(e, key), c = catOf(e.catId), s = e.allDay ? 0 : toMin(e.time) ?? 0
    return { key: `e-${e.id}-${key}`, title: e.title, sub: c.label, color: c.color, icon: EVENT_ICON[e.catId], start: s, end: Math.min(1440, s + Math.max(15, Math.round((o.end - o.start) / 60000))), timed: !e.allDay, occ: o }
  })
  const hs = tasksOn(state, date).map((t): Item => {
    const m = toMin(t.time ?? ''), s = m ?? 0, c = catById(t.catId)
    return { key: `h-${t.id}-${key}`, title: t.text, sub: `${c.label} · ${isHabit(t) ? 'Habit' : 'Task'}`, color: c.color, icon: c.icon, start: s, end: Math.min(1440, s + (t.duration ?? 30)), timed: m !== null, task: t, done: habitDone(state, t, date) }
  })
  return [...evs, ...hs]
}

/** All-day events first, then timed items by start, then habits without a time. */
const rank = (i: Item) => (i.occ && !i.timed ? 0 : i.timed ? 1 : 2)
const sortItems = (items: Item[]) => [...items].sort((a, b) => rank(a) - rank(b) || a.start - b.start || a.title.localeCompare(b.title))

/** Where an item stands right now, relative to the day being viewed. */
function statusOf(i: Item, now: Date, sel: Date): { label: string; tone: Tone } {
  const t = now.getTime(), nowMin = now.getHours() * 60 + now.getMinutes()
  const rel = ymd(sel) === ymd(mid(now)) ? 0 : sel < mid(now) ? -1 : 1
  if (i.occ) {
    if (!i.timed) return rel < 0 ? { label: 'Ended', tone: 'past' } : { label: 'All day', tone: 'plain' }
    if (rel < 0 || (rel === 0 && t >= i.occ.end)) return { label: 'Ended', tone: 'past' }
    if (rel === 0 && t >= i.occ.start) return { label: 'In progress', tone: 'live' }
    if (rel === 0 && i.occ.start - t <= 3600000) return { label: whenLabel(i.occ.start, t), tone: 'soon' }
    return { label: 'Upcoming', tone: 'plain' }
  }
  if (i.done) return { label: 'Done', tone: 'done' }
  if (rel < 0) return { label: 'Missed', tone: 'late' }
  if (rel > 0) return { label: 'Scheduled', tone: 'plain' }
  if (!i.timed) return { label: 'To do', tone: 'plain' }
  if (nowMin >= i.end) return { label: 'Overdue', tone: 'late' }
  if (nowMin >= i.start) return { label: 'In progress', tone: 'live' }
  return { label: 'Upcoming', tone: 'plain' }
}

/** Side-by-side lanes for overlapping items in a day column. */
function lanes(items: Item[]) {
  const out = new Map<string, { lane: number; of: number }>()
  let group: Item[] = [], groupEnd = -1, ends: number[] = []
  const flush = () => { group.forEach(i => { out.get(i.key)!.of = ends.length }); group = []; ends = []; groupEnd = -1 }
  for (const it of [...items].sort((a, b) => a.start - b.start || b.end - a.end)) {
    if (group.length && it.start >= groupEnd) flush()
    let lane = ends.findIndex(e => e <= it.start)
    if (lane < 0) { lane = ends.length; ends.push(it.end) } else ends[lane] = it.end
    out.set(it.key, { lane, of: 1 })
    group.push(it)
    groupEnd = Math.max(groupEnd, it.end)
  }
  flush()
  return out
}

function ViewTabs({ value, onChange }: { value: CalView; onChange: (v: CalView) => void }) {
  const index = VIEWS.findIndex(v => v.id === value)
  return (
    <div role="group" aria-label="Calendar view" className="relative grid grid-cols-3 rounded-full border border-white/10 bg-white/[0.04] p-1 text-sm">
      <span aria-hidden="true" className="an-thumb absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full border border-teal/30 bg-teal/15" style={{ transform: `translateX(${index * 100}%)` }} />
      {VIEWS.map(v => (
        <button key={v.id} type="button" aria-pressed={value === v.id} onClick={() => onChange(v.id)}
          className={`relative z-10 min-w-[4.25rem] rounded-full px-3 py-1.5 transition-colors ${value === v.id ? 'text-ink' : 'text-ink/60 hover:text-ink'}`}>{v.label}</button>
      ))}
    </div>
  )
}

function Tile({ icon, color, size = 'size-10' }: { icon: IconName; color: string; size?: string }) {
  return (
    <span aria-hidden="true" className={`grid ${size} shrink-0 place-items-center rounded-xl`} style={{ backgroundColor: `${color}26`, color }}>
      <Icon name={icon} className="size-[18px]" />
    </span>
  )
}

/**
 * One row. Events wear their category colour and open the editor; habits stay quiet and can be ticked off,
 * so the two are easy to tell apart at a glance.
 */
function Row({ i, n, sel, now, compact, onOpen, onToggle }: {
  i: Item; n: number; sel: Date; now: Date; compact: boolean
  onOpen: (o: Occurrence) => void; onToggle: (id: string) => void
}) {
  const isToday = ymd(sel) === ymd(mid(now))
  const st = statusOf(i, now, sel), e = i.occ?.event
  const when = i.occ && !i.timed ? 'All day' : i.timed ? fmtTime(hhmm(i.start)) : 'Anytime'
  const parts: string[] = []
  if (e) {
    if (compact) parts.push(fmtRange(e), i.sub); else { parts.push(i.sub); if (i.timed) parts.push(fmtDur(i.end - i.start)) }
    if (e.repeat !== 'none') parts.push((REPEATS.find(r => r.id === e.repeat)?.label ?? '').toLowerCase())
  } else {
    if (compact && i.timed) parts.push(when)
    parts.push(i.sub)
    if (i.task?.duration) parts.push(fmtDur(i.task.duration))
  }
  const quiet = compact && !e
  const base = `flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left ${quiet ? 'px-2.5 py-2' : 'px-3 py-2.5'}`
  const body = (
    <>
      <Tile icon={i.icon} color={i.color} size={quiet ? 'size-8' : 'size-10'} />
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-medium ${quiet ? 'text-[13px]' : 'text-sm'} ${i.done ? 'text-ink/60' : ''}`}>{i.title}</span>
        <span className="block truncate text-xs text-ink/55">{!compact && <span className="sm:hidden">{when} · </span>}{parts.join(' · ')}</span>
        {e?.notes && !compact && <span className="mt-0.5 block truncate text-xs text-ink/40">{e.notes}</span>}
      </span>
    </>
  )
  const showPill = compact ? !!e && (st.tone === 'live' || st.tone === 'soon') : true
  const pill = showPill && <span className={`shrink-0 rounded-md font-medium ${compact ? 'px-2 py-0.5 text-[11px]' : 'hidden px-2 py-1 text-[11px] sm:inline-block'} ${TONE[st.tone]}`}>{st.label}</span>
  return (
    <li className="cal-in flex items-start gap-3" style={step(n)}>
      {!compact && <span className="hidden w-[4.25rem] shrink-0 pt-3.5 text-xs tabular-nums text-ink/60 sm:block">{when}</span>}
      {e ? (
        <button type="button" onClick={() => onOpen(i.occ!)} style={evStyle(i.color, st.tone === 'live')} className={`${base} transition-[filter] hover:brightness-125`}>
          {body}
          {e.reminder !== null && (
            <span title={REMINDERS.find(r => r.value === e.reminder)?.label} className="flex shrink-0 items-center gap-1 text-[11px] tabular-nums text-ink/50">
              <Icon name="bell" className="size-3.5" /><span className={compact ? 'sr-only' : 'hidden sm:inline'}>{shortRem(e.reminder)}</span>
            </span>
          )}
          {pill}
        </button>
      ) : (
        <div className={`${base} bg-white/[0.035] ring-1 ring-white/[0.08] ${i.done ? 'opacity-75' : ''}`}>
          {body}
          {pill}
          {isToday ? <Switch checked={!!i.done} onChange={() => onToggle(i.task!.id)} label={`${i.title}: mark ${i.done ? 'not done' : 'done'}`} className="ml-1" />
            : <span className={`shrink-0 text-[11px] ${st.tone === 'late' ? 'text-red-300' : 'text-ink/50'}`}>{st.label}</span>}
        </div>
      )}
    </li>
  )
}

/**
 * The list for one day. Roomy and chronological in the Day view (events and habits interleaved, with a marker for the current time);
 * in the side panel it splits into an Events block and a quieter Habits block.
 */
function DayList({ items, sel, now, compact = false, onOpen, onToggle }: {
  items: Item[]; sel: Date; now: Date; compact?: boolean
  onOpen: (o: Occurrence) => void; onToggle: (id: string) => void
}) {
  const isToday = ymd(sel) === ymd(mid(now)), nowMin = now.getHours() * 60 + now.getMinutes()
  const list = sortItems(items)
  const common = { sel, now, compact, onOpen, onToggle }

  if (compact) {
    const evs = list.filter(i => i.occ), hs = list.filter(i => i.task), done = hs.filter(h => h.done).length
    const head = (n: number, label: string, right: string, accent: boolean) => (
      <h4 className="cal-in mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.18em]" style={step(n)}>
        <span className={`flex items-center gap-2 ${accent ? 'text-ink' : 'text-ink/50'}`}><i aria-hidden="true" className={`h-3 w-1 rounded-full ${accent ? 'bg-teal' : 'bg-white/25'}`} />{label}</span>
        <span className="font-normal normal-case tracking-normal tabular-nums text-ink/50">{right}</span>
      </h4>
    )
    return (
      <div className="space-y-5">
        <section aria-label="Events">
          {head(1, 'Events', String(evs.length), true)}
          {evs.length ? (
            <ul className="space-y-2">{evs.map((i, k) => <Row key={i.key} i={i} n={2 + k} {...common} />)}</ul>
          ) : (
            <p className="cal-in rounded-xl border border-dashed border-white/12 px-3 py-3 text-sm text-ink/50" style={step(2)}>No events planned for this day.</p>
          )}
        </section>
        {hs.length > 0 && (
          <section aria-label="Habits">
            {head(2 + Math.max(evs.length, 1), 'Habits', isToday || sel < mid(now) ? `${done}/${hs.length} done` : plural(hs.length, 'habit'), false)}
            <ul className="space-y-1.5">{hs.map((i, k) => <Row key={i.key} i={i} n={3 + Math.max(evs.length, 1) + k} {...common} />)}</ul>
          </section>
        )}
      </div>
    )
  }

  const showNow = isToday && list.some(i => i.timed)
  let markAt = list.findIndex(i => (i.timed ? i.start > nowMin : !!i.task))
  if (markAt < 0) markAt = list.length
  const marker = (
    <li aria-hidden="true" className="cal-in flex items-center gap-3 py-0.5" style={step(markAt + 1)}>
      <span className="shrink-0 text-[11px] font-medium tabular-nums text-red-300 sm:w-[4.25rem]">{fmtTime(hhmm(nowMin))}</span>
      <span className="relative h-px flex-1 bg-red-400/60"><b className="absolute -left-1 -top-[3px] size-[7px] rounded-full bg-red-400" /></span>
    </li>
  )
  return (
    <ul className="space-y-2.5">
      {list.map((i, idx) => <Fragment key={i.key}>{showNow && idx === markAt && marker}<Row i={i} n={idx + 1} {...common} /></Fragment>)}
      {showNow && markAt === list.length && marker}
    </ul>
  )
}

function EmptyDay({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="cal-in grid place-items-center px-4 py-12 text-center" style={step(1)}>
      <span aria-hidden="true" className="grid size-12 place-items-center rounded-2xl bg-white/[0.06] text-ink/60 ring-1 ring-white/10"><Icon name="calendar" className="size-6" /></span>
      <p className="mt-4 font-medium">Nothing planned</p>
      <p className="mt-1 max-w-xs text-sm text-ink/55">Add an event, or give a habit a time and it will appear here.</p>
      <button type="button" onClick={onAdd} className="mt-5 flex items-center gap-1.5 rounded-lg bg-teal px-3.5 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90">
        <Icon name="plus" className="size-4" />Add event
      </button>
    </div>
  )
}

/**
 * Every event still to come, earliest first. The next one is spotlighted; the rest fold open on demand.
 * A repeating event is listed once, at its next occurrence, so a daily event cannot flood the list.
 */
function UpcomingCard({ list, today, now, onPick, onAdd, children }: {
  list: Occurrence[]; today: Date; now: Date
  onPick: (date: string) => void; onAdd: () => void; children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const first = list[0], rest = list.slice(1)
  const rel = (o: Occurrence) => { const n = dayDiff(o.date, today); return o.start <= now.getTime() && !o.event.allDay ? 'Happening now' : n <= 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days` }

  let spot: ReactNode = null
  if (first) {
    const e = first.event, c = catOf(e.catId), d = parseYmd(first.date), soon = !e.allDay && first.start - now.getTime() <= 3600000 && first.end > now.getTime()
    spot = (
      <button key={`${e.id}-${first.date}`} type="button" onClick={() => onPick(first.date)}
        className="cal-spot relative isolate mt-3 block w-full overflow-hidden rounded-2xl p-4 text-left transition-[filter,transform] hover:brightness-110 active:scale-[0.99]"
        style={{ background: `radial-gradient(120% 140% at 0% 0%, ${c.color}3a, transparent 62%), rgba(255,255,255,0.045)`, boxShadow: `inset 0 0 0 1px ${c.color}59, 0 16px 36px -20px ${c.color}` }}>
        <span aria-hidden="true" className="halo absolute -right-12 -top-12 -z-10 size-44 rounded-full blur-2xl" style={{ backgroundColor: `${c.color}40` }} />
        <span className="flex items-start gap-3.5">
          <span className="grid w-12 shrink-0 place-items-center rounded-xl py-1.5 text-center" style={{ backgroundColor: `${c.color}26`, color: c.color }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
            <span className="text-xl font-bold leading-none tabular-nums">{d.getDate()}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${c.color}26`, color: c.color }}>{rel(first)}</span>
              {soon && <i aria-hidden="true" className="pulse-dot size-1.5 rounded-full" style={{ backgroundColor: c.color }} />}
              <span className={`${eyebrow} ml-auto text-ink/40`}>Next up</span>
            </span>
            <span className="mt-2 block text-base font-semibold leading-snug">{e.title}</span>
            <span className="mt-1 flex items-center gap-1.5 text-xs text-ink/70"><Icon name="clock" className="size-3.5" />{fmtRange(e)}</span>
            {e.notes && <span className="mt-1 block truncate text-xs text-ink/50">{e.notes}</span>}
          </span>
        </span>
        <span className="mt-3.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink/65">
          <span className="rounded-full bg-white/[0.07] px-2 py-0.5">{c.label}</span>
          {e.reminder !== null && <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.07] px-2 py-0.5"><Icon name="bell" className="size-3" />{REMINDERS.find(r => r.value === e.reminder)?.label}</span>}
          {e.repeat !== 'none' && <span className="rounded-full bg-white/[0.07] px-2 py-0.5">{REPEATS.find(r => r.id === e.repeat)?.label}</span>}
        </span>
      </button>
    )
  }

  return (
    <section className="glass fade-up rounded-2xl p-5" style={{ animationDelay: '270ms' }} aria-label="Coming up">
      <div className="flex items-center justify-between">
        <h3 className={`${eyebrow} text-ink/55`}>Coming up</h3>
        {list.length > 0 && <span className="text-[11px] tabular-nums text-ink/45">{list.length} planned</span>}
      </div>
      {first ? (
        <>
          {spot}
          {rest.length > 0 && (
            <button type="button" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(o => !o)}
              className="mt-3 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm text-ink/75 ring-1 ring-white/10 transition-colors hover:bg-white/[0.06] hover:text-ink">
              <span>{open ? 'Hide the rest' : `${rest.length} more ${rest.length === 1 ? 'event' : 'events'}`}</span>
              <Icon name="chevron" className={`size-4 transition-transform duration-500 ${open ? '-rotate-90' : 'rotate-90'}`} />
            </button>
          )}
          <div id={listId} className="cal-fold" data-open={open} inert={!open}>
            <div>
              <ul className="-mx-1 max-h-72 space-y-0.5 overflow-y-auto px-1 pb-0.5 pt-2 [scrollbar-width:thin]">
                {rest.map((o, k) => {
                  const e = o.event, c = catOf(e.catId), d = parseYmd(o.date)
                  return (
                    <li key={`${e.id}-${o.date}`} className="cal-fold-item" style={step(k)}>
                      <button type="button" onClick={() => onPick(o.date)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/[0.07]">
                        <span className="w-10 shrink-0 text-center leading-none">
                          <span className="block text-[10px] uppercase tracking-wider text-ink/45">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                          <span className="mt-1 block text-base font-semibold tabular-nums">{d.getDate()}</span>
                        </span>
                        <i aria-hidden="true" className="h-9 w-1 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{e.title}</span>
                          <span className="block truncate text-xs text-ink/55">{d.toLocaleDateString('en-US', { month: 'short' })} · {e.allDay ? 'All day' : fmtTime(e.time)}{e.repeat !== 'none' ? ` · ${(REPEATS.find(r => r.id === e.repeat)?.label ?? '').toLowerCase()}` : ''}</span>
                        </span>
                        {e.reminder !== null && <Icon name="bell" className="size-3.5 shrink-0 text-ink/45" />}
                        <span className="shrink-0 text-[11px] text-ink/50">{rel(o)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-white/12 px-4 py-5 text-center">
          <p className="text-sm text-ink/60">No events planned yet.</p>
          <button type="button" onClick={onAdd} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm transition-colors hover:border-teal/40 hover:text-teal"><Icon name="plus" className="size-4" />Add event</button>
        </div>
      )}
      {children}
    </section>
  )
}

/** Compact month for jumping around; dots mark days that have events. */
function MiniMonth({ sel, today, dots, onPick }: { sel: Date; today: Date; dots: Map<string, string[]>; onPick: (d: Date) => void }) {
  const btn = 'grid size-8 place-items-center rounded-lg text-ink/70 transition-colors hover:bg-white/[0.07] hover:text-ink'
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">{MONTHS[sel.getMonth()]} {sel.getFullYear()}</h3>
        <div className="flex">
          <button type="button" aria-label="Previous month" onClick={() => onPick(addMonths(sel, -1))} className={btn}><Icon name="chevron" className="size-4 rotate-180" /></button>
          <button type="button" aria-label="Next month" onClick={() => onPick(addMonths(sel, 1))} className={btn}><Icon name="chevron" className="size-4" /></button>
        </div>
      </div>
      <div aria-hidden="true" className="grid grid-cols-7 text-center text-[10px] font-medium uppercase tracking-wider text-ink/45">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => <span key={i} className="py-1">{l}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {monthGrid(sel).map(d => {
          const k = ymd(d), isSel = k === ymd(sel), isNow = k === ymd(today), c = dots.get(k)
          return (
            <button key={k} type="button" onClick={() => onPick(d)} aria-label={longDay(d)} aria-pressed={isSel} aria-current={isNow ? 'date' : undefined}
              className={`relative mx-auto grid size-8 place-items-center rounded-full text-xs tabular-nums transition-colors ${isSel ? 'bg-teal font-semibold text-bg' : isNow ? 'text-teal ring-1 ring-teal/60' : d.getMonth() === sel.getMonth() ? 'text-ink/80 hover:bg-white/[0.08]' : 'text-ink/30 hover:bg-white/[0.05]'} ${c && !isSel && !isNow ? 'bg-white/[0.08] font-medium' : ''}`}>
              {d.getDate()}
              {c && <span aria-hidden="true" className="absolute bottom-[3px] flex gap-px">{c.map((col, j) => <i key={j} className="size-[3px] rounded-full" style={{ backgroundColor: isSel ? '#06121a' : col }} />)}</span>}
            </button>
          )
        })}
      </div>
    </>
  )
}

/** Jump to any month and year, or to an exact date. */
function JumpMenu({ sel, onPick, onClose }: { sel: Date; onPick: (d: Date) => void; onClose: () => void }) {
  const [year, setYear] = useState(sel.getFullYear())
  const [text, setText] = useState(String(year))
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const setY = (y: number) => { const c = Math.min(MAX_YEAR, Math.max(MIN_YEAR, y)); setYear(c); setText(String(c)) }
  return (
    <>
      <button type="button" aria-label="Close" tabIndex={-1} className="fixed inset-0 z-20 cursor-default" onClick={onClose} />
      <div role="dialog" aria-label="Jump to month and year" className="absolute left-0 top-full z-30 mt-2 w-72 rounded-2xl border border-white/10 bg-panel/95 p-4 shadow-2xl shadow-black/50 backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" aria-label="Previous year" onClick={() => setY(year - 1)} className={iconBtn}><Icon name="chevron" className="size-4 rotate-180" /></button>
          <input aria-label="Year" type="number" min={MIN_YEAR} max={MAX_YEAR} value={text} onChange={e => { setText(e.target.value); const y = Number(e.target.value); if (y >= MIN_YEAR && y <= MAX_YEAR) setYear(y) }}
            className="w-24 rounded-lg border border-line bg-bg px-3 py-1.5 text-center text-sm tabular-nums focus:border-teal/50" />
          <button type="button" aria-label="Next year" onClick={() => setY(year + 1)} className={iconBtn}><Icon name="chevron" className="size-4" /></button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONTHS.map((m, i) => (
            <button key={m} type="button" onClick={() => onPick(withYearMonth(sel, year, i))}
              className={`rounded-lg px-2 py-2 text-sm transition-colors ${year === sel.getFullYear() && i === sel.getMonth() ? 'bg-teal/15 text-teal' : 'text-ink/75 hover:bg-white/[0.07]'}`}>{m.slice(0, 3)}</button>
          ))}
        </div>
        <div className="mt-4 text-xs text-ink/60">
          <span className="mb-1.5 block">Go to a date</span>
          <DatePicker variant="field" label="Go to a date" value={ymd(sel)} onChange={iso => { if (iso) onPick(parseYmd(iso)) }} min={`${MIN_YEAR}-01-01`} max={`${MAX_YEAR}-12-31`}
            weekStart={loadPreferences().startOfWeek === 'sunday' ? 0 : 1} format={loadPreferences().dateFormat} clearable={false} />
        </div>
      </div>
    </>
  )
}

/** Week view: all-day strip on top, then an hour grid with the current time marked. */
function TimeGrid({ days, byDay, sel, now, onSelect, onSlot, onOpen }: {
  days: Date[]; byDay: Map<string, Item[]>; sel: Date; now: Date
  onSelect: (d: Date) => void; onSlot: (d: Date, minutes: number) => void; onOpen: (o: Occurrence) => void
}) {
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => { if (body.current) body.current.scrollTop = 7 * HOUR - 8 }, [days.length])
  const cols = `3rem repeat(${days.length}, minmax(0, 1fr))`
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return (
    <div>
      <div className="grid border-b border-white/[0.07]" style={{ gridTemplateColumns: cols }}>
        <span />
        {days.map(d => {
          const isToday = ymd(d) === ymd(mid(now)), strip = (byDay.get(ymd(d)) ?? []).filter(i => !i.timed)
          return (
            <div key={ymd(d)} className="min-w-0 border-l border-white/[0.07] px-1.5 pb-2 pt-1">
              <button type="button" onClick={() => onSelect(d)} aria-pressed={ymd(d) === ymd(sel)} className="mx-auto flex flex-col items-center rounded-lg px-2 py-1 hover:bg-white/[0.05]">
                <span className="text-[11px] uppercase tracking-wider text-ink/55">{DOW[(d.getDay() + 6) % 7]}</span>
                <span className={`mt-0.5 grid size-7 place-items-center rounded-full text-sm tabular-nums ${isToday ? 'bg-teal font-semibold text-bg' : ymd(d) === ymd(sel) ? 'ring-1 ring-white/40' : ''}`}>{d.getDate()}</span>
              </button>
              <div className="mt-1 space-y-1">
                {strip.map(i => i.occ ? (
                  <button key={i.key} type="button" onClick={() => onOpen(i.occ!)} className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px]" style={{ backgroundColor: `${i.color}26`, boxShadow: `inset 2px 0 0 ${i.color}` }}>{i.title}</button>
                ) : (
                  <span key={i.key} className={`block truncate rounded border border-dashed border-white/15 px-1.5 py-0.5 text-[11px] text-ink/65 ${i.done ? 'line-through opacity-60' : ''}`}>{i.title}</span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <div ref={body} className="max-h-[32rem] overflow-y-auto">
        <div className="relative grid" style={{ gridTemplateColumns: cols, height: 24 * HOUR }}>
          <div aria-hidden="true">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="pr-2 text-right text-[10px] tabular-nums text-ink/45" style={{ height: HOUR }}>
                {h > 0 && <span className="relative -top-1.5">{new Date(2000, 0, 1, h).toLocaleTimeString('en-US', { hour: 'numeric' })}</span>}
              </div>
            ))}
          </div>
          {days.map(d => {
            const timed = (byDay.get(ymd(d)) ?? []).filter(i => i.timed), place = lanes(timed), isToday = ymd(d) === ymd(mid(now))
            return (
              <div key={ymd(d)} role="presentation" className="relative border-l border-white/[0.07]"
                style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR - 1}px, rgba(255,255,255,0.07) ${HOUR - 1}px, rgba(255,255,255,0.07) ${HOUR}px)` }}
                onClick={e => onSlot(d, Math.min(23 * 60 + 30, Math.floor(((e.clientY - e.currentTarget.getBoundingClientRect().top) / HOUR) * 2) * 30))}>
                {timed.map(i => {
                  const p = place.get(i.key)!, style: CSSProperties = { top: (i.start / 60) * HOUR, height: Math.max(((i.end - i.start) / 60) * HOUR - 2, 22), left: `${(p.lane / p.of) * 100}%`, width: `calc(${100 / p.of}% - 3px)` }
                  return i.occ ? (
                    <button key={i.key} type="button" onClick={e => { e.stopPropagation(); onOpen(i.occ!) }} className="absolute overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] leading-tight transition-[filter] hover:brightness-125"
                      style={{ ...style, backgroundColor: `${i.color}33`, boxShadow: `inset 3px 0 0 ${i.color}` }}>
                      <span className="block truncate font-medium">{i.title}</span><span className="block truncate text-ink/65">{fmtRange(i.occ.event)}</span>
                    </button>
                  ) : (
                    <div key={i.key} onClick={e => e.stopPropagation()} title={`${i.title} · ${i.sub}`} className={`absolute overflow-hidden rounded-md border border-dashed px-1.5 py-1 text-[11px] leading-tight text-ink/70 ${i.done ? 'opacity-50' : ''}`}
                      style={{ ...style, borderColor: `${i.color}99` }}><span className={`block truncate ${i.done ? 'line-through' : ''}`}>{i.title}</span></div>
                  )
                })}
                {isToday && <i aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-10 h-px bg-red-400" style={{ top: (nowMin / 60) * HOUR }}><b className="absolute -left-1 -top-[3px] size-[7px] rounded-full bg-red-400" /></i>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Calendar({ state, events, onToggle, startDate }: Props) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(i) }, [])
  const [view, setViewState] = useState<CalView>(loadView)
  const [sel, setSel] = useState(() => mid(startDate ?? new Date()))
  const [dir, setDir] = useState<'cal-next' | 'cal-prev'>('cal-next')
  const [jump, setJump] = useState(false)
  const [modal, setModal] = useState<ModalState | null>(null)
  const readPerm = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  const [perm, setPerm] = useState<string>(readPerm)
  const kbd = useRef(false)
  const today = mid(now)

  const go = (d: Date) => { const n = mid(d); setDir(n >= sel ? 'cal-next' : 'cal-prev'); setSel(n); setJump(false) }
  const setView = (v: CalView) => { setViewState(v); saveView(v) }
  const openNew = (date: string, time?: string) => setModal({ date, time })
  const enableAlerts = () => { void ensureNotifyPermission().then(() => setPerm(readPerm())) }

  // Day view shows a week strip, so it needs the whole week; the month view needs all 42 cells.
  const days = view === 'month' ? monthGrid(sel) : weekDays(sel)
  const byDay = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const d of days) m.set(ymd(d), itemsOn(events.events, state, d))
    return m
  }, [events.events, state, view, ymd(sel)]) // eslint-disable-line react-hooks/exhaustive-deps
  const selList = useMemo(() => sortItems(byDay.get(ymd(sel)) ?? []), [byDay, ymd(sel)]) // eslint-disable-line react-hooks/exhaustive-deps

  const monthDots = useMemo(() => {
    const m = new Map<string, string[]>()
    if (view !== 'day') return m
    for (const d of monthGrid(sel)) {
      const cs = events.events.filter(e => occursOn(e, d)).map(e => catOf(e.catId).color)
      if (cs.length) m.set(ymd(d), cs.slice(0, 3))
    }
    return m
  }, [events.events, view, sel.getFullYear(), sel.getMonth()]) // eslint-disable-line react-hooks/exhaustive-deps

  // Every upcoming event, earliest first; a repeating event only at its next occurrence.
  const upList = useMemo(() => {
    const seen = new Set<string>()
    return occurrencesBetween(events.events, today, addDays(today, 365)).filter(o => {
      if (o.end <= now.getTime()) return false
      if (o.event.repeat === 'none') return true
      if (seen.has(o.event.id)) return false
      seen.add(o.event.id)
      return true
    })
  }, [events.events, ymd(today), Math.floor(now.getTime() / 60000)]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (kbd.current) { kbd.current = false; document.querySelector<HTMLButtonElement>(`[data-day="${ymd(sel)}"]`)?.focus() }
  }, [sel])
  const onGridKey = (e: ReactKey<HTMLDivElement>) => {
    const next: Record<string, Date> = {
      ArrowLeft: addDays(sel, -1), ArrowRight: addDays(sel, 1), ArrowUp: addDays(sel, -7), ArrowDown: addDays(sel, 7),
      PageUp: shiftDate('month', sel, -1), PageDown: shiftDate('month', sel, 1),
    }
    if (!next[e.key]) return
    e.preventDefault()
    kbd.current = true
    go(next[e.key])
  }

  const save = (f: EventFields) => {
    if (modal?.event) events.update(modal.event.id, f)
    else events.add(f)
    if (f.reminder !== null) enableAlerts()
    setModal(null)
    go(parseYmd(f.date))
  }
  const remove = (scope: 'one' | 'all') => {
    if (!modal?.event) return
    if (scope === 'one' && modal.occDate) events.skipDay(modal.event.id, modal.occDate)
    else events.remove(modal.event.id)
    setModal(null)
  }
  const openEvent = (o: Occurrence) => setModal({ event: o.event, occDate: o.date, date: o.event.date })

  const wk = weekDays(sel)
  const title = view === 'week'
    ? `${wk[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${wk[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : `${MONTHS[sel.getMonth()]} ${sel.getFullYear()}`
  // The arrows page by month in the month view and by week otherwise, matching what is on screen.
  const stepView: CalView = view === 'month' ? 'month' : 'week'
  const isToday = ymd(sel) === ymd(today)
  const nEvents = selList.filter(i => i.occ).length
  const habits = selList.filter(i => i.task)
  const habitsDone = habits.filter(i => i.done).length
  const pct = habits.length ? Math.round((habitsDone / habits.length) * 100) : 0
  const next = selList.find(i => (isToday ? (i.task ? !i.done : !!i.occ && i.timed && i.occ.end > now.getTime()) : true))
  const askAlerts = perm === 'default' && events.events.some(e => e.reminder !== null)
  const quote = QUOTES[Math.floor(today.getTime() / 86400000) % QUOTES.length]
  const note = upList[0] ? planNote(upList[0], now, today) : null
  const paneCls = dir === 'cal-next' ? 'cal-pane-next' : 'cal-pane-prev'
  const flash = <span key={`f-${ymd(sel)}`} aria-hidden="true" className="cal-flash pointer-events-none absolute inset-x-0 top-0 h-28 rounded-t-2xl bg-gradient-to-b from-teal/[0.16] to-transparent" />
  const dayHeading = (
    <div className="cal-in flex items-start justify-between gap-3" style={step(0)}>
      <div>
        <p className={`${eyebrow} text-ink/55`}>{isToday ? 'Today' : sel.toLocaleDateString('en-US', { weekday: 'long' })}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">{isToday ? longDay(sel) : sel.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: sel.getFullYear() === today.getFullYear() ? undefined : 'numeric' })}</h2>
        <p className="mt-0.5 text-xs text-ink/55">{plural(nEvents, 'event')} · {plural(habits.length, 'habit')}</p>
      </div>
      <button type="button" onClick={() => openNew(ymd(sel))} aria-label="Add event on this day" className={`${iconBtn} border border-white/10`}><Icon name="plus" className="size-4" /></button>
    </div>
  )

  return (
    <div className="hb-cards">
      <TopBar name={state.name}>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-ink/60">Your time. Your goals. All in one place.</p>
        </div>
      </TopBar>

      <div className="fade-up flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex items-center gap-1">
          <button type="button" aria-label={`Previous ${stepView}`} onClick={() => go(shiftDate(stepView, sel, -1))} className={iconBtn}><Icon name="chevron" className="size-4 rotate-180" /></button>
          <button type="button" aria-label={`Next ${stepView}`} onClick={() => go(shiftDate(stepView, sel, 1))} className={iconBtn}><Icon name="chevron" className="size-4" /></button>
          <button type="button" aria-haspopup="dialog" aria-expanded={jump} onClick={() => setJump(j => !j)} className="ml-1 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xl font-semibold tracking-tight transition-colors hover:bg-white/[0.07]">
            {title}<Icon name="chevron" className={`size-4 text-ink/50 transition-transform ${jump ? '-rotate-90' : 'rotate-90'}`} />
          </button>
          {jump && <JumpMenu sel={sel} onPick={go} onClose={() => setJump(false)} />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => go(today)} disabled={isToday && view !== 'month'} className={`${ghostBtn} disabled:opacity-40`}>Today</button>
          <ViewTabs value={view} onChange={setView} />
          <button type="button" onClick={() => openNew(ymd(sel))} className="flex items-center gap-1.5 rounded-lg bg-teal px-3.5 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90">
            <Icon name="plus" className="size-4" />Add event
          </button>
        </div>
      </div>

      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        {view === 'day' ? (
          <div className="min-w-0 space-y-4">
            <div key={ymd(wk[0])} role="group" aria-label="Week" onKeyDown={onGridKey} className={`fade-up grid grid-cols-7 gap-1.5 sm:gap-2.5 ${dir}`}>
              {wk.map((d, n) => {
                const k = ymd(d), isSel = k === ymd(sel), isNow = k === ymd(today)
                const dots = (byDay.get(k) ?? []).filter(i => i.occ).slice(0, 3)
                return (
                  <button key={k} type="button" data-day={k} tabIndex={isSel ? 0 : -1} aria-pressed={isSel} aria-current={isNow ? 'date' : undefined} onClick={() => go(d)} aria-label={longDay(d)}
                    style={dots.length && !isSel ? { backgroundColor: `${dots[0].color}14`, borderColor: `${dots[0].color}59` } : undefined}
                    className={`flex flex-col items-center gap-1 rounded-2xl border px-1 py-3 transition-colors ${isSel ? 'border-teal/50 bg-teal/[0.12] shadow-[0_8px_24px_-12px_rgba(100,232,211,0.5)]' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'}`}>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-ink/55">{DOW[n]}</span>
                    <span className={`text-xl font-semibold tabular-nums ${isNow ? 'text-teal' : ''}`}>{d.getDate()}</span>
                    <span aria-hidden="true" className="flex h-1.5 gap-0.5">{dots.map(i => <i key={i.key} className="size-1.5 rounded-full" style={{ backgroundColor: i.color }} />)}</span>
                  </button>
                )
              })}
            </div>

            <section className="glass fade-up rounded-2xl p-5 sm:p-6" style={{ animationDelay: '90ms' }} aria-label="Schedule for the selected day">
              {flash}
              <div key={ymd(sel)} className={paneCls}>
                {dayHeading}
                <div className="mt-5">
                  {selList.length ? <DayList items={selList} sel={sel} now={now} onOpen={openEvent} onToggle={onToggle} /> : <EmptyDay onAdd={() => openNew(ymd(sel))} />}
                </div>
              </div>
            </section>
          </div>
        ) : (
          <section className="glass fade-up min-w-0 overflow-hidden rounded-2xl" style={{ animationDelay: '90ms' }}>
            <div key={`${view}-${ymd(days[0])}`} className={dir}>
              {view === 'month' ? (
                <>
                  <div className="grid grid-cols-7 border-b border-white/[0.07] py-2.5 text-center text-[11px] uppercase tracking-wider text-ink/55">{DOW.map(d => <span key={d}>{d}</span>)}</div>
                  <div role="group" aria-label={title} onKeyDown={onGridKey} className="grid grid-cols-7">
                    {days.map(d => {
                      const k = ymd(d), its = byDay.get(k) ?? [], evs = its.filter(i => i.occ), hs = its.filter(i => i.task)
                      const isSel = k === ymd(sel), isNow = k === ymd(today), hDone = hs.filter(h => h.done).length
                      const tints = [...new Set(evs.map(i => i.color))].slice(0, 3)
                      // Every event on the day has ended -> "happened" (green cell + check). Otherwise it is upcoming or in progress (full outline + glow).
                      const happened = evs.length > 0 && evs.every(i => i.occ!.end <= now.getTime())
                      const upcoming = evs.length > 0 && !happened
                      return (
                        <div key={k} className="group relative">
                          <button type="button" data-day={k} tabIndex={isSel ? 0 : -1} aria-pressed={isSel} aria-current={isNow ? 'date' : undefined} onClick={() => go(d)} onDoubleClick={() => openNew(k)}
                            aria-label={`${longDay(d)}, ${plural(evs.length, 'event')}${evs.length ? (happened ? ' (done)' : ' (upcoming)') : ''}${hs.length ? `, ${plural(hs.length, 'habit')}` : ''}`}
                            style={tints.length ? {
                              ['--c' as string]: happened ? HAPPENED : tints[0],
                              // Happened days are calmer (softer tint); upcoming days are brighter and get the animated ring below.
                              background: happened
                                ? `linear-gradient(180deg, ${HAPPENED}${isSel ? '40' : '26'}, ${HAPPENED}0d 75%)`
                                : `linear-gradient(180deg, ${tints[0]}${isSel ? '4d' : '2e'}, ${tints[0]}${isSel ? '1a' : '0d'} 75%)`,
                              // The selected day gets a white inner ring on top of its outline.
                              boxShadow: happened ? `inset 0 0 0 1.5px ${HAPPENED}${isSel ? 'cc' : '66'}${isSel ? ', inset 0 0 0 3.5px rgba(255,255,255,.3)' : ''}` : isSel ? 'inset 0 0 0 3.5px rgba(255,255,255,.4)' : undefined,
                            } : undefined}
                            className={`relative flex h-full min-h-[3.6rem] w-full flex-col items-start gap-1 overflow-hidden border-b border-r border-white/[0.07] p-1.5 text-left transition-colors sm:min-h-[6.25rem] ${isSel ? 'bg-white/[0.08] ring-1 ring-inset ring-white/40' : tints.length ? 'hover:brightness-125' : 'hover:bg-white/[0.04]'} ${d.getMonth() !== sel.getMonth() ? 'text-ink/35' : ''}`}>
                            {tints.length > 0 && <span aria-hidden="true" className={`absolute inset-x-0 top-0 flex ${happened ? 'h-[4px]' : 'h-[3px]'}`}>{(happened ? [HAPPENED] : tints).map(c => <i key={c} className="flex-1" style={{ backgroundColor: c }} />)}</span>}
                            {upcoming && <span aria-hidden="true" className="cal-ring" />}
                            {happened && (
                              <span aria-hidden="true" className="cal-done" title="Done">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                              </span>
                            )}
                            <span className={`grid size-6 place-items-center rounded-full text-xs tabular-nums ${isNow ? 'bg-teal font-semibold text-bg' : isSel ? 'ring-1 ring-white/40' : ''} ${evs.length && !isNow ? 'font-semibold' : ''}`}>{d.getDate()}</span>
                            {evs.slice(0, 3).map(i => (
                              <span key={i.key} className="hidden w-full truncate rounded px-1.5 py-0.5 text-[11px] leading-tight sm:block" style={{ backgroundColor: `${i.color}26`, boxShadow: `inset 2px 0 0 ${i.color}` }}>{i.title}</span>
                            ))}
                            {evs.length > 3 && <span className="hidden px-1 text-[10px] text-ink/55 sm:block">+{evs.length - 3} more</span>}
                            {evs.length > 0 && <span className="flex gap-0.5 sm:hidden">{evs.slice(0, 3).map(i => <i key={i.key} className="size-1.5 rounded-full" style={{ backgroundColor: i.color }} />)}</span>}
                            {hs.length > 0 && (
                              <span className="mt-auto flex items-center gap-1 text-[10px] tabular-nums text-ink/50" title={`${plural(hs.length, 'habit')} scheduled`}>
                                <i className="size-1.5 rounded-full bg-teal/70" />{d <= today ? `${hDone}/${hs.length}` : hs.length}
                              </span>
                            )}
                          </button>
                          <button type="button" aria-label={`Add event on ${longDay(d)}`} onClick={() => openNew(k)}
                            className="absolute right-1 top-1 hidden size-6 place-items-center rounded-md text-ink/60 hover:bg-white/10 hover:text-ink group-hover:grid"><Icon name="plus" className="size-3.5" /></button>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <TimeGrid days={days} byDay={byDay} sel={sel} now={now} onSelect={go} onOpen={openEvent} onSlot={(d, m) => openNew(ymd(d), hhmm(m))} />
              )}
            </div>
          </section>
        )}

        <div className="min-w-0 space-y-6">
          {view === 'day' ? (
            <>
              <section className="glass fade-up rounded-2xl p-5" style={{ animationDelay: '150ms' }} aria-label="Month overview">
                <MiniMonth sel={sel} today={today} dots={monthDots} onPick={go} />
              </section>
              <section className="glass fade-up rounded-2xl p-5" style={{ animationDelay: '210ms' }} aria-label={isToday ? 'Today’s focus' : 'Day overview'}>
                <div className="flex items-center justify-between">
                  <h3 className={`${eyebrow} text-ink/55`}>{isToday ? 'Today’s focus' : 'Day overview'}</h3>
                  {habits.length > 0 && <span className="text-xs font-medium tabular-nums text-teal">{pct}%</span>}
                </div>
                {next ? (
                  <div key={next.key} className="swap mt-3 flex items-center gap-3">
                    <Tile icon={next.icon} color={next.color} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{next.title}</span>
                      <span className="block truncate text-xs text-ink/55">{next.occ && !next.timed ? 'All day' : next.timed ? fmtTime(hhmm(next.start)) : 'Anytime'} · {next.sub}</span>
                    </span>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-ink/60">{habits.length && habitsDone === habits.length ? 'Everything is done for today.' : 'Nothing left on the list.'}</p>
                )}
                {habits.length > 0 && (
                  <div className="mt-4">
                    <div role="progressbar" aria-label="Habits completed" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="hb-w h-full rounded-full bg-gradient-to-r from-mint to-teal" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-2 text-xs tabular-nums text-ink/55">{habitsDone} of {plural(habits.length, 'habit')} done</p>
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="glass fade-up rounded-2xl p-5" style={{ animationDelay: '150ms' }} aria-label="Selected day">
              {flash}
              <div key={ymd(sel)} className={paneCls}>
                {dayHeading}
                <div className="mt-5">
                  {selList.length
                    ? <DayList items={selList} sel={sel} now={now} compact onOpen={openEvent} onToggle={onToggle} />
                    : <p className="cal-in text-sm text-ink/60" style={step(1)}>Nothing planned for this day. Add an event, or schedule a habit with a time.</p>}
                </div>
              </div>
            </section>
          )}

          <UpcomingCard list={upList} today={today} now={now} onPick={k => go(parseYmd(k))} onAdd={() => openNew(ymd(sel))}>
            {askAlerts && (
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                <Icon name="bell" className="size-4 shrink-0 text-teal" />
                <p className="min-w-0 flex-1 text-xs leading-snug text-ink/70">Also show your reminders as system notifications.</p>
                <button type="button" onClick={enableAlerts} className="shrink-0 rounded-lg bg-teal px-3 py-1.5 text-xs font-medium text-bg transition-opacity hover:opacity-90">Allow</button>
              </div>
            )}
          </UpcomingCard>
        </div>
      </div>

      <section className="fade-up relative isolate mt-6 flex min-h-28 items-center overflow-hidden rounded-2xl border border-white/15 px-6 py-6 shadow-xl shadow-black/40 sm:px-8" style={{ animationDelay: '330ms' }} aria-label="Heads up">
        <LiveScene theme="dusk" lite />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/15" />
        {note && <span aria-hidden="true" className="absolute inset-y-5 left-0 w-1 rounded-r-full" style={{ backgroundColor: note.color }} />}
        <div key={note ? note.head : quote} className="swap relative max-w-xl">
          {note ? (
            <>
              <p className={`${eyebrow} flex items-center gap-1.5 text-ink/60`}><Icon name="bell" className="size-3" />Heads up</p>
              <p className="mt-2 text-lg font-semibold leading-snug text-ink [text-shadow:0_1px_12px_rgba(0,0,0,0.6)]">{note.head}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink/80 [text-shadow:0_1px_12px_rgba(0,0,0,0.6)]">{note.tip}</p>
            </>
          ) : (
            <>
              <p className={`${eyebrow} text-ink/60`}>EVOLVE</p>
              <p className="mt-2 text-lg font-medium leading-snug text-ink/95 [text-shadow:0_1px_12px_rgba(0,0,0,0.6)]">&ldquo;{quote}&rdquo;</p>
            </>
          )}
        </div>
      </section>

      {modal && <EventModal initial={modal.event} date={modal.date} time={modal.time} onSave={save} onDelete={modal.event ? remove : undefined} onClose={() => setModal(null)} />}
    </div>
  )
}
