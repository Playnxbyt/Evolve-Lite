import { useCallback, useEffect, useState } from 'react'
import { loadPreferences, weekStartIndex } from './preferences'

/**
 * Calendar events: types, recurrence, reminders and storage.
 * Habits and tasks are not stored here. The calendar reads them from the existing app state.
 */
export type EventCat = 'personal' | 'deadline' | 'professional' | 'social' | 'important'
export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
export type CalView = 'month' | 'week' | 'day'

export interface CalEvent {
  id: string
  title: string
  notes: string
  /** First occurrence, YYYY-MM-DD in local time. */
  date: string
  allDay: boolean
  /** HH:MM, empty for all-day events. */
  time: string
  endTime: string
  catId: EventCat
  /** Minutes before the start; null for no reminder. */
  reminder: number | null
  repeat: Repeat
  /** Last day a repeating event may occur; empty for no end. */
  until: string
  /** Single occurrences removed from a repeating series. */
  skip: string[]
}
export type EventFields = Omit<CalEvent, 'id' | 'skip'>
export interface Occurrence { event: CalEvent; date: string; start: number; end: number }
export interface EventsApi {
  events: CalEvent[]
  add: (f: EventFields) => void
  update: (id: string, f: EventFields) => void
  remove: (id: string) => void
  skipDay: (id: string, date: string) => void
}

// Green is kept free on purpose: it marks days whose events have already happened in the month view.
export const EVENT_CATS: { id: EventCat; label: string; color: string }[] = [
  { id: 'personal', label: 'Personal', color: '#38bdf8' },
  { id: 'deadline', label: 'Deadline', color: '#ff7a6b' },
  { id: 'professional', label: 'Professional', color: '#a78bfa' },
  { id: 'social', label: 'Social', color: '#f472b6' },
  { id: 'important', label: 'Important', color: '#f0b45a' },
]
/** Categories from earlier versions, mapped to the closest current one so saved events keep working. */
const LEGACY_CATS: Record<string, EventCat> = { college: 'professional', meeting: 'professional', exam: 'deadline', health: 'personal' }
export const catOf = (id: EventCat) => EVENT_CATS.find(c => c.id === id) ?? EVENT_CATS[0]
export const REMINDERS: { value: number | null; label: string }[] = [
  { value: null, label: 'No reminder' }, { value: 0, label: 'At time of event' }, { value: 5, label: '5 minutes before' },
  { value: 15, label: '15 minutes before' }, { value: 30, label: '30 minutes before' }, { value: 60, label: '1 hour before' }, { value: 1440, label: '1 day before' },
]
export const REPEATS: { id: Repeat; label: string }[] = [
  { id: 'none', label: 'Does not repeat' }, { id: 'daily', label: 'Every day' }, { id: 'weekly', label: 'Every week' },
  { id: 'monthly', label: 'Every month' }, { id: 'yearly', label: 'Every year' },
]
export const MIN_YEAR = 1900
export const MAX_YEAR = 2200
/** All-day events remind relative to this time of day. */
export const ALL_DAY_REMIND_HOUR = 9

/* ---------- dates ---------- */
const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
/** Moves by whole months and keeps the day of month where it fits (31 Jan + 1 month = 28/29 Feb). */
export const addMonths = (d: Date, n: number) => {
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1)
  return new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), daysInMonth(t.getFullYear(), t.getMonth())))
}
export const withYearMonth = (d: Date, year: number, month: number) =>
  new Date(year, month, Math.min(d.getDate(), daysInMonth(year, month)))
/** 42 days (six Monday-first weeks) covering the month of `d`. */
export const monthGrid = (d: Date) => {
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const start = addDays(first, -((first.getDay() - weekStartIndex() + 7) % 7))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}
export const weekDays = (d: Date) => Array.from({ length: 7 }, (_, i) => addDays(d, i - ((d.getDay() - weekStartIndex() + 7) % 7)))
export const shiftDate = (view: CalView, d: Date, dir: 1 | -1) => (view === 'month' ? addMonths(d, dir) : addDays(d, dir * (view === 'week' ? 7 : 1)))
export const toMin = (t: string) => (/^\d{2}:\d{2}$/.test(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null)
export const fmtTime = (t: string) => {
  const m = toMin(t)
  return m === null ? '' : new Date(2000, 0, 1, Math.floor(m / 60), m % 60).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: loadPreferences().timeFormat === '12h' })
}
export const fmtRange = (e: Pick<CalEvent, 'time' | 'endTime' | 'allDay'>) =>
  e.allDay || !e.time ? 'All day' : e.endTime ? `${fmtTime(e.time)} – ${fmtTime(e.endTime)}` : fmtTime(e.time)

/* ---------- recurrence ---------- */
export function occursOn(e: CalEvent, d: Date): boolean {
  const key = ymd(d)
  if (key < e.date || (e.until && key > e.until) || e.skip.includes(key)) return false
  const base = parseYmd(e.date), last = daysInMonth(d.getFullYear(), d.getMonth())
  switch (e.repeat) {
    case 'none': return key === e.date
    case 'daily': return true
    case 'weekly': return d.getDay() === base.getDay()
    case 'monthly': return d.getDate() === Math.min(base.getDate(), last)
    case 'yearly': return d.getMonth() === base.getMonth() && d.getDate() === Math.min(base.getDate(), last)
  }
}
const at = (date: string, hhmm: string) => {
  const d = parseYmd(date), m = toMin(hhmm) ?? 0
  d.setHours(Math.floor(m / 60), m % 60, 0, 0)
  return d.getTime()
}
export function occurrence(e: CalEvent, date: string): Occurrence {
  if (e.allDay || !e.time) return { event: e, date, start: parseYmd(date).getTime(), end: addDays(parseYmd(date), 1).getTime() }
  const start = at(date, e.time), end = e.endTime ? at(date, e.endTime) : start + 3600000
  return { event: e, date, start, end: end > start ? end : start + 3600000 }
}
/** Every occurrence from `from` to `to` (inclusive days), all-day first, then by start. */
export function occurrencesBetween(events: CalEvent[], from: Date, to: Date): Occurrence[] {
  const out: Occurrence[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) for (const e of events) if (occursOn(e, d)) out.push(occurrence(e, ymd(d)))
  return out.sort((a, b) => a.start - b.start || Number(b.event.allDay) - Number(a.event.allDay))
}

/* ---------- reminders ---------- */
export interface Due { key: string; title: string; body: string; start: number; catId: EventCat }
export function whenLabel(start: number, now: number) {
  const mins = Math.round((start - now) / 60000)
  if (mins <= 0) return 'Starting now'
  if (mins < 60) return `In ${mins} min`
  if (mins < 1440) return `In ${Math.round(mins / 60)} h`
  return `In ${Math.round(mins / 1440)} day${Math.round(mins / 1440) === 1 ? '' : 's'}`
}
/** Reminders whose moment has passed, whose event has not ended, and that have not fired yet. */
export function dueReminders(events: CalEvent[], now: Date, fired: Set<string>): Due[] {
  const t = now.getTime(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const out: Due[] = []
  for (const o of occurrencesBetween(events.filter(e => e.reminder !== null), addDays(today, -1), addDays(today, 3))) {
    const e = o.event
    const base = e.allDay ? o.start + ALL_DAY_REMIND_HOUR * 3600000 : o.start
    const key = `${e.id}|${o.date}|${e.reminder}`
    if (fired.has(key) || t < base - (e.reminder ?? 0) * 60000 || t >= o.end) continue
    out.push({ key, title: e.title, body: `${whenLabel(base, t)} · ${fmtRange(e)}`, start: o.start, catId: e.catId })
  }
  return out
}

/* ---------- storage ---------- */
const KEY = 'evolveCalendarEvents', FIRED_KEY = 'evolveCalendarFired', VIEW_KEY = 'evolveCalendarView'
const isCat = (v: unknown): v is EventCat => EVENT_CATS.some(c => c.id === v)
const isRepeat = (v: unknown): v is Repeat => REPEATS.some(r => r.id === v)
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

function normalize(raw: unknown): CalEvent | null {
  const r = raw as Partial<Record<keyof CalEvent, unknown>> | null
  if (!r || typeof r.id !== 'string' || typeof r.title !== 'string' || !r.title.trim() || !isDate(r.date)) return null
  const allDay = r.allDay === true || toMin(String(r.time ?? '')) === null
  return {
    id: r.id, title: r.title.slice(0, 80), notes: typeof r.notes === 'string' ? r.notes.slice(0, 500) : '', date: r.date, allDay,
    time: allDay ? '' : String(r.time), endTime: !allDay && toMin(String(r.endTime ?? '')) !== null ? String(r.endTime) : '',
    catId: isCat(r.catId) ? r.catId : typeof r.catId === 'string' ? LEGACY_CATS[r.catId] ?? 'personal' : 'personal',
    reminder: typeof r.reminder === 'number' && r.reminder >= 0 ? r.reminder : null,
    repeat: isRepeat(r.repeat) ? r.repeat : 'none', until: isDate(r.until) ? r.until : '',
    skip: Array.isArray(r.skip) ? r.skip.filter(isDate) : [],
  }
}
export function loadEvents(): CalEvent[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list.map(normalize).filter((e): e is CalEvent => e !== null) : []
  } catch { return [] }
}
export function saveEvents(events: CalEvent[]) {
  try { localStorage.setItem(KEY, JSON.stringify(events)) } catch { /* storage full or blocked */ }
}
export const loadFired = (): string[] => {
  try { const v: unknown = JSON.parse(localStorage.getItem(FIRED_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [] } catch { return [] }
}
export const saveFired = (keys: string[]) => {
  try { localStorage.setItem(FIRED_KEY, JSON.stringify(keys.slice(-300))) } catch { /* ignore */ }
}
export const loadView = (): CalView => {
  try { const v = localStorage.getItem(VIEW_KEY); return v === 'week' || v === 'month' ? v : 'day' } catch { return 'day' }
}
export const saveView = (v: CalView) => { try { localStorage.setItem(VIEW_KEY, v) } catch { /* ignore */ } }

/** Event state with persistence. Lives in App so the calendar page and the reminder host share one list. */
export function useEvents(): EventsApi {
  const [events, setEvents] = useState<CalEvent[]>(loadEvents)
  useEffect(() => { saveEvents(events) }, [events])
  useEffect(() => {
    const sync = (e: StorageEvent) => { if (e.key === KEY) setEvents(loadEvents()) } // another tab changed them
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  const add = useCallback((f: EventFields) => setEvents(cur => [...cur, { ...f, id: crypto.randomUUID(), skip: [] }]), [])
  const update = useCallback((id: string, f: EventFields) => setEvents(cur => cur.map(e => (e.id === id ? { ...e, ...f } : e))), [])
  const remove = useCallback((id: string) => setEvents(cur => cur.filter(e => e.id !== id)), [])
  const skipDay = useCallback((id: string, date: string) => setEvents(cur => cur.map(e => (e.id === id ? { ...e, skip: [...e.skip, date] } : e))), [])
  return { events, add, update, remove, skipDay }
}

/** Asks for browser notifications. Call from a click so the browser allows the prompt. */
export async function ensureNotifyPermission() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'default') return
  try { await Notification.requestPermission() } catch { /* ignore */ }
}
