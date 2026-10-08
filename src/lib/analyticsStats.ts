import { CATS, habitDone, isScheduledOn, streak, tasksOn, type AppState, type CatId, type Task } from './core'
import type { IconName } from '../components/Icons'
import { weekStartIndex } from './preferences'
import { addDays, bestFullDayRun, isHabit } from './habitStats'

/**
 * Analytics numbers, kept free of React so the rules live in one place.
 *
 * Counting rule: a check-in is "possible" on every day a task is scheduled, from the day it was created
 * (or the start of the range, whichever is later) up to and including today. Days still ahead are never
 * counted, so the percentages are not dragged down by a week that has not happened yet.
 * Overall figures use every task (so history of deleted habits and one-off tasks still counts);
 * the habit rankings only look at habits that are still active.
 */
export type RangeId = '7' | '30' | '90' | 'all'
export const RANGES: { id: RangeId; label: string }[] = [
  { id: '7', label: '7 days' }, { id: '30', label: '30 days' }, { id: '90', label: '90 days' }, { id: 'all', label: 'All time' },
]
export const WEEKDAY_NAMES = weekStartIndex() === 0 ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const WEEKDAY_SHORT = weekStartIndex() === 0 ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export interface Tally { done: number; possible: number }
export interface DayTally extends Tally { date: Date }
export interface Bucket extends Tally { start: Date; end: Date; label: string; short: string; partial: boolean }
export interface WeekdayRow extends Tally { index: number; days: number }
export interface HabitRow extends Tally { t: Task; missed: number }
export interface CatRow extends Tally { cat: (typeof CATS)[number]; delta: number | null }

/**
 * How the month is counted, from the top down:
 *   possible = every time a task is scheduled this month (its weekdays, from the day it was created),
 *   due      = the part of that which has already come around (up to and including today),
 *   done     = what was actually checked off.
 */
export interface MonthCat extends Tally { cat: (typeof CATS)[number]; due: number }
export interface MonthMix {
  label: string
  days: number
  elapsed: number
  /** Only categories that have something scheduled this month. */
  cats: MonthCat[]
  /** `possible` is the whole month; `due` is what has come around so far. */
  total: Tally
  due: number
  /** Days where every scheduled item was done / days with at least one check-in. */
  perfectDays: number
  activeDays: number
}
/** One spoke of the stats radar: how well you complete the tasks of one category, 0 to 100. */
export interface RadarAxis { id: CatId; label: string; color: string; value: number; known: boolean; done: number; possible: number; hint: string }
export type CoachKind = 'win' | 'fix' | 'tip'
export interface CoachStep { kind: CoachKind; icon: IconName; title: string; body: string }
export interface Coach { lead: string; steps: CoachStep[] }

export interface Analytics {
  month: MonthMix
  radar: RadarAxis[]
  coach: Coach
  days: number
  start: Date
  end: Date
  hasTasks: boolean
  total: Tally
  /** Change in consistency (percentage points) against the previous period of the same length; null for All time or without data. */
  delta: number | null
  cmpWord: string
  buckets: Bucket[]
  bucketKind: 'day' | 'week' | 'month'
  weekdays: WeekdayRow[]
  habits: HabitRow[]
  cats: CatRow[]
  weekly: Bucket[]
  monthly: Bucket[]
  streak: number
  longest: number
  avgHabitRate: number | null
}

const MAX_DAYS = 1095
const DAY_MS = 86400000
const MIN_SAMPLE = 3
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const daysBetween = (a: Date, b: Date) => Math.round((midnight(b).getTime() - midnight(a).getTime()) / DAY_MS)
const mondayIdx = (d: Date) => (d.getDay() - weekStartIndex() + 7) % 7
const fmtDay = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const sum = (xs: Tally[]): Tally => xs.reduce((a, x) => ({ done: a.done + x.done, possible: a.possible + x.possible }), { done: 0, possible: 0 })
export const pct = (t: Tally) => (t.possible ? Math.round((t.done / t.possible) * 100) : 0)
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

/** Tallies every day from `first` to `last` once; the returned function slices that cache by date. */
function tallier(s: AppState, first: Date, last: Date) {
  const cache: DayTally[] = Array.from({ length: daysBetween(first, last) + 1 }, (_, i) => {
    const date = addDays(first, i)
    const ts = tasksOn(s, date)
    return { date, possible: ts.length, done: ts.filter(t => habitDone(s, t, date)).length }
  })
  return (from: Date, to: Date) => cache.slice(Math.max(0, daysBetween(first, from)), daysBetween(first, to) + 1)
}

function habitTally(s: AppState, t: Task, from: Date, to: Date): Tally {
  let done = 0, possible = 0
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (d.getTime() < t.createdAt || !isScheduledOn(t, d)) continue
    possible++
    if (habitDone(s, t, d)) done++
  }
  return { done, possible }
}

function catTallies(s: AppState, from: Date, to: Date) {
  const by = new Map<string, Tally>(CATS.map(c => [c.id, { done: 0, possible: 0 }]))
  for (let d = from; d <= to; d = addDays(d, 1)) {
    for (const t of tasksOn(s, d)) {
      const x = by.get(t.catId)
      if (!x) continue
      x.possible++
      if (habitDone(s, t, d)) x.done++
    }
  }
  return by
}

function group(ds: DayTally[], kind: 'week' | 'month', today: Date): Bucket[] {
  const by = new Map<string, DayTally[]>()
  for (const d of ds) {
    const k = kind === 'week' ? midnight(addDays(d.date, -mondayIdx(d.date))).getTime().toString() : `${d.date.getFullYear()}-${d.date.getMonth()}`
    by.set(k, [...(by.get(k) ?? []), d])
  }
  return [...by.values()].map(xs => bucket(xs, kind, today))
}

function bucket(xs: DayTally[], kind: 'day' | 'week' | 'month', today: Date): Bucket {
  const start = xs[0].date, end = xs[xs.length - 1].date
  const t = sum(xs)
  const label = kind === 'day' ? start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    : kind === 'week' ? `${fmtDay(start)} – ${fmtDay(end)}`
    : start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const short = kind === 'month' ? start.toLocaleDateString('en-US', { month: 'short' }) : fmtDay(start)
  return { ...t, start, end, label, short, partial: end.getTime() >= today.getTime() }
}

const CAT_TIPS: Record<CatId, string[]> = {
  health: ['Lay out what you need the night before, so there is nothing to decide in the moment.', 'Agree on a "minimum version" for rough days (ten minutes still counts) so the habit never fully breaks.'],
  mindset: ['Tie it to something you already do every day, like right after brushing your teeth, so it stops depending on motivation.', 'Start tiny: two minutes every day beats twenty minutes twice a week.'],
  productivity: ['Do it first, before messages and notifications start pulling you around.', 'Write the very first step on a sticky note tonight, so starting takes no thinking.'],
  learning: ['Shrink the session to 15 minutes and protect that slot; consistency beats long sessions.', 'Leave the book or app open where you will see it, so starting is a single tap.'],
  lifestyle: ['Set a phone reminder at the scheduled time for two weeks, until it becomes automatic.', 'Pair it with something you already enjoy, so it feels like a treat rather than a chore.'],
}
const TARGET = 80
const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0] // Monday first; 0 = Sunday
const dayName = (n: number) => WEEKDAY_SHORT[(n + 6) % 7]
const describeDays = (t: Task) => !t.days ? 'every day' : DAYS_ORDER.filter(d => t.days!.includes(d as never)).map(dayName).join(', ')
const lowerFirst = (x: string) => x.charAt(0).toLowerCase() + x.slice(1)

interface CoachInput {
  s: AppState; today: Date; days: number; total: Tally; delta: number | null; cmpWord: string
  habits: HabitRow[]; cats: CatRow[]; tracked: number; cur: number; longest: number
}

/** Turns the numbers into plain-language advice, written the way a coach would say it. */
function buildCoach(i: CoachInput): Coach {
  const { s, today, days, total, delta, cmpWord, habits, cats, tracked, cur, longest } = i
  const first = (s.name || '').trim().split(/\s+/)[0]
  const seed = Math.floor(today.getTime() / DAY_MS) // new wording each day, stable within a day
  const pick = <T,>(xs: T[], salt = 0) => xs[(seed + salt) % xs.length]
  const say = (x: string) => (first ? `${first}, ${lowerFirst(x)}` : x)
  const rate = pct(total)

  // ---- the opening read
  let lead: string
  if (tracked < MIN_SAMPLE) {
    lead = say(pick([
      "You're at the very start of your pattern, and starting is the hardest part. Don't chase a perfect week yet: check in for the next three days and I'll have real advice for you.",
      "It's early days, so there isn't a pattern to read yet. Show up for three days in a row and we'll look at what's working.",
    ]))
  } else {
    const gap = Math.max(0, TARGET - rate)
    const n = `${total.done} of the ${total.possible} check-ins that have come up so far (${rate}%)`
    const base = rate >= 85
      ? pick([`You've completed ${n}. That's excellent consistency, so the job now is to protect it rather than add more.`,
              `You've completed ${n}. That kind of reliability is rare, so keep the routine steady.`])
      : rate >= 65
      ? pick([`You've completed ${n}${gap ? `, only ${gap} points short of the ${TARGET}% mark` : ''}. That's a strong base, and a few more will get you there.`,
              `You've completed ${n}. You have the habit of showing up; now it's about closing the last few gaps.`])
      : rate >= 40
      ? pick([`You've completed ${n}. That's a genuine start: you're past the hardest part, and the next step is making the tricky habits easier to begin.`,
              `You've completed ${n}. There's real momentum here, and a couple of small tweaks can lift it quickly.`])
      : pick([`You've completed ${n}. That usually means the plan is bigger than your current routine, not that you're failing, so let's make it easier to win.`,
              `You've completed ${n}. That's where you are today, and small repeatable wins will move it faster than big promises.`])
    const trend = delta !== null && delta >= 5 ? ` You're also up ${delta} points on the previous ${cmpWord}.`
      : delta !== null && delta <= -5 ? ` That's ${-delta} points lower than the previous ${cmpWord}, so something has been getting in the way.` : ''
    lead = say(base) + trend
  }

  // ---- concrete next steps, most useful first
  const cand: { pri: number; step: CoachStep }[] = []
  const solid = habits.filter(h => h.possible >= MIN_SAMPLE)
  const weak = [...solid].filter(h => h.done / h.possible < 0.6).sort((a, b) => a.done / a.possible - b.done / b.possible || b.missed - a.missed)[0]
  const best = [...solid].filter(h => h.done / h.possible >= 0.7).sort((a, b) => b.done / b.possible - a.done / a.possible || b.possible - a.possible)[0]

  if (weak) {
    const t = weak.t, r = Math.round((weak.done / weak.possible) * 100)
    const tip = t.duration && t.duration >= 40
      ? `It's a ${t.duration}-minute block, which is a lot to find on a busy day. Agree on a 10-minute minimum version for those days so it still counts.`
      : pick(CAT_TIPS[t.catId], weak.possible)
    const slot = !(t.duration && t.duration >= 40) && t.time && weak.missed >= 3 ? ` If the ${t.time} slot keeps getting swallowed, move it to a time you genuinely have free.` : ''
    cand.push({ pri: 1, step: { kind: 'fix', icon: 'goal', title: `${r < 35 ? 'Rescue' : 'Firm up'} "${t.text}"`, body: `You've done it ${weak.done} of ${weak.possible} scheduled times (${r}%), so this is where your biggest gain is. ${tip}${slot}` } })
  }
  if (best) {
    const t = best.t, r = Math.round((best.done / best.possible) * 100)
    const link = weak ? ` Try doing "${weak.t.text}" right after it: new habits stick best when they follow one you never miss.` : ' Protect it, and use it as the cue for your next habit.'
    cand.push({ pri: 3, step: { kind: 'win', icon: 'check', title: `Keep "${t.text}" going`, body: `${best.done} of ${best.possible} times (${r}%) means it's a true anchor in your routine.${link}` } })
  }
  if (delta !== null && delta <= -5) {
    cand.push({ pri: 2, step: { kind: 'fix', icon: 'analytics', title: "Reset, don't push harder", body: `You're ${-delta} points below the previous ${cmpWord}. Rather than trying harder, trim your list to the two or three habits that matter most for a week, then add the rest back.` } })
  } else if (delta !== null && delta >= 5) {
    cand.push({ pri: 3.5, step: { kind: 'win', icon: 'analytics', title: "You're trending up", body: `That's ${delta} points better than the previous ${cmpWord}. Something you changed is working, so write down what it was and keep doing it.` } })
  }
  if (cur > 0 && longest > cur && longest - cur <= 3) {
    cand.push({ pri: 4, step: { kind: 'tip', icon: 'flame', title: 'Beat your best streak', body: `You're on a ${cur}-day streak and your record is ${longest}. ${plural(longest - cur + 1, 'more full day')} sets a new one, so don't let a busy day break the chain.` } })
  } else if (cur >= 3 && cur >= longest) {
    cand.push({ pri: 4, step: { kind: 'win', icon: 'flame', title: 'A personal best', body: `${plural(cur, 'day')} in a row is your longest streak yet. On hard days, do the minimum version: showing up still counts.` } })
  } else if (cur === 0 && tracked >= MIN_SAMPLE) {
    cand.push({ pri: 4.5, step: { kind: 'tip', icon: 'flame', title: 'Start a fresh streak', body: "Your streak is at zero right now, and that's fine. Finish everything that's due today and day one is done; momentum builds from there." } })
  }

  // habits piled onto the same weekday
  if (habits.length >= 3) {
    const load = Array.from({ length: 7 }, (_, d) => habits.filter(h => !h.t.days || h.t.days.includes(d as never)).length)
    const hi = load.indexOf(Math.max(...load)), lo = load.indexOf(Math.min(...load))
    if (load[hi] >= 4 && load[hi] - load[lo] >= 2) {
      const hiName = WEEKDAY_NAMES[(hi + 6) % 7], loName = WEEKDAY_NAMES[(lo + 6) % 7]
      cand.push({ pri: 5, step: { kind: 'tip', icon: 'calendar', title: `Lighten your ${hiName}s`, body: `You've scheduled ${load[hi]} habits on ${hiName}s but only ${load[lo]} on ${loName}s. Overloaded days are where streaks usually break, so consider moving one habit to ${loName}.` } })
    }
  }

  // today
  const due = tasksOn(s, today), left = due.filter(t => !habitDone(s, t, today))
  if (due.length > 0 && left.length > 0) {
    const quick = [...left].sort((a, b) => (a.duration ?? 25) - (b.duration ?? 25))[0]
    cand.push({ pri: 5.5, step: { kind: 'tip', icon: 'clock', title: 'Win the rest of today', body: `${plural(left.length, 'thing')} left today. Start with "${quick.text}"${quick.duration ? ` (${quick.duration} min)` : ''}: finishing the quick one first makes the rest feel lighter.` } })
  } else if (due.length > 0) {
    cand.push({ pri: 5.5, step: { kind: 'win', icon: 'check', title: 'Today is done', body: 'Everything due today is checked off. Rest well; recovery is part of the plan.' } })
  }

  // lopsided categories
  const ranked = cats.filter(c => c.possible >= MIN_SAMPLE).sort((a, b) => pct(b) - pct(a))
  if (ranked.length >= 2 && pct(ranked[0]) - pct(ranked[ranked.length - 1]) >= 20) {
    const hi = ranked[0], lo = ranked[ranked.length - 1]
    cand.push({ pri: 6, step: { kind: 'tip', icon: lo.cat.icon, title: `Lift ${lo.cat.label}`, body: `${hi.cat.label} is at ${pct(hi)}% while ${lo.cat.label} sits at ${pct(lo)}%. Whatever makes ${hi.cat.label} easy for you, like a fixed time or a visible reminder, is worth copying over.` } })
  }

  if (cand.length === 0) {
    cand.push({ pri: 9, step: { kind: 'tip', icon: 'bulb', title: 'Make one habit unmissable', body: 'Choose the single habit that matters most this week and treat it as non-negotiable. One reliable habit beats five shaky ones.' } })
  }
  return { lead, steps: cand.sort((a, b) => a.pri - b.pri).slice(0, 3).map(c => c.step) }
}

export function buildAnalytics(s: AppState, range: RangeId, now: Date): Analytics {
  const today = midnight(now)
  const first = s.tasks.reduce((m, t) => Math.min(m, t.createdAt), Infinity)
  const days = range === 'all'
    ? (Number.isFinite(first) ? Math.min(MAX_DAYS, Math.max(1, daysBetween(new Date(first), today) + 1)) : 7)
    : Number(range)
  const start = addDays(today, -(days - 1))
  const cmp = range === 'all' ? 30 : days // length of the "recent" and "previous" windows used for comparisons
  const curStart = addDays(today, -(cmp - 1)), prevStart = addDays(curStart, -cmp), prevEnd = addDays(curStart, -1)
  const weeksStart = addDays(today, -mondayIdx(today) - 7 * 7)
  const monthsStart = new Date(today.getFullYear(), today.getMonth() - 5, 1)
  const earliest = [start, prevStart, weeksStart, monthsStart].reduce((a, b) => (b < a ? b : a))
  const at = tallier(s, earliest, today)

  const daily = at(start, today)
  const total = sum(daily)
  const prevTotal = range === 'all' ? null : sum(at(prevStart, prevEnd))
  const delta = prevTotal && prevTotal.possible > 0 && total.possible > 0 ? pct(total) - pct(prevTotal) : null

  // Trend: one point per day up to a month, then per week (or per month for long histories).
  const bucketKind = days <= 30 ? 'day' : days <= 130 ? 'week' : 'month'
  const buckets = bucketKind === 'day' ? daily.map(d => bucket([d], 'day', today)) : group(daily, bucketKind, today)

  const weekdays: WeekdayRow[] = Array.from({ length: 7 }, (_, index) => {
    const ds = daily.filter(d => mondayIdx(d.date) === index && d.possible > 0)
    return { index, days: ds.length, ...sum(ds) }
  })

  const active = s.tasks.filter(isHabit)
  const habits: HabitRow[] = active
    .map(t => {
      const x = habitTally(s, t, start, today)
      const pendingToday = isScheduledOn(t, today) && today.getTime() >= t.createdAt && !habitDone(s, t, today) ? 1 : 0
      return { t, ...x, missed: x.possible - x.done - pendingToday }
    })
    .filter(h => h.possible > 0)
  const avgHabitRate = habits.length ? Math.round(habits.reduce((n, h) => n + h.done / h.possible, 0) / habits.length * 100) : null

  const catNow = catTallies(s, start, today)
  const catCur = catTallies(s, curStart, today), catPrev = catTallies(s, prevStart, prevEnd)
  const cats: CatRow[] = CATS.map(cat => {
    const x = catNow.get(cat.id)!, c = catCur.get(cat.id)!, p = catPrev.get(cat.id)!
    const delta = range !== 'all' && c.possible >= MIN_SAMPLE && p.possible >= MIN_SAMPLE ? pct(c) - pct(p) : null
    return { cat, ...x, delta }
  }).filter(c => c.possible > 0)

  const weekly = Array.from({ length: 8 }, (_, k) => {
    const from = addDays(weeksStart, 7 * k)
    const to = addDays(from, 6) > today ? today : addDays(from, 6)
    return bucket(at(from, to), 'week', today)
  })
  const monthly = Array.from({ length: 6 }, (_, k) => {
    const from = new Date(monthsStart.getFullYear(), monthsStart.getMonth() + k, 1)
    const end = new Date(from.getFullYear(), from.getMonth() + 1, 0)
    return bucket(at(from, end > today ? today : end), 'month', today)
  })

  const cur = streak(s, now)
  const longest = Math.max(cur, bestFullDayRun(s, now, 400))
  const cmpWord = `${cmp} days`

  const tracked = daily.filter(d => d.possible > 0).length

  // This month: everything scheduled across the whole month, how much of it has come due, and how much is done.
  const monthDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const mc = new Map<string, MonthCat>(CATS.map(c => [c.id, { cat: c, done: 0, possible: 0, due: 0 }]))
  let perfectDays = 0, activeDays = 0
  for (let n = 1; n <= monthDays; n++) {
    const d = new Date(today.getFullYear(), today.getMonth(), n)
    const past = d <= today
    const isToday = d.getTime() === today.getTime()
    const ts = tasksOn(s, d)
    const doneToday = past ? ts.filter(t => habitDone(s, t, d)).length : 0
    if (doneToday > 0) activeDays++
    if (ts.length > 0 && doneToday === ts.length) perfectDays++
    for (const t of ts) {
      const x = mc.get(t.catId)
      if (!x) continue
      x.possible++
      // A day only counts as passed once it is over. Today's unchecked tasks are still pending, not missed.
      if (past) {
        const done = habitDone(s, t, d)
        if (done) x.done++
        if (done || !isToday) x.due++
      }
    }
  }
  const mCats = [...mc.values()].filter(c => c.possible > 0)
  const month: MonthMix = {
    label: today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    days: monthDays, elapsed: today.getDate(), cats: mCats, total: sum(mCats), due: mCats.reduce((n, c) => n + c.due, 0), perfectDays, activeDays,
  }

  // Radar: each category scored as done / everything scheduled for it this month (same counting as the month card).
  const radar: RadarAxis[] = CATS.map(cat => {
    const x = mc.get(cat.id)!
    const known = x.possible > 0
    const hint = known ? `${x.done} of ${x.possible} scheduled this month done` : 'Nothing scheduled this month'
    return { id: cat.id, label: cat.label, color: cat.color, value: known ? Math.round((x.done / x.possible) * 100) : 0, known, done: x.done, possible: x.possible, hint }
  })

  const coach = buildCoach({ s, today, days, total, delta, cmpWord, habits, cats, tracked, cur, longest })

  return {
    month, radar, coach,
    days, start, end: today, hasTasks: s.tasks.length > 0, total, delta, cmpWord, buckets, bucketKind, weekdays, habits, cats,
    weekly, monthly, streak: cur, longest, avgHabitRate,
  }
}
