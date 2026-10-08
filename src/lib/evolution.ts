import { CATS, habitDone, startOfDay, streak as currentStreak, tasksOn, XP_PER_TASK, type AppState, type CatId, type Goal, type Task } from './core'
import { addDays, isHabit } from './habitStats'

/**
 * Everything the Evolution page shows, derived from data EVOLVE already keeps. Nothing here is stored.
 *
 * Twenty levels, Rookie to Conqueror. Each level costs about 38% more XP than the one before, so the early levels
 * arrive within days and the last one (60,000 XP, 6,000 check-ins) is a multi-year commitment.
 *
 * The one XP rule: every completed check-in is worth XP_PER_TASK (10) XP, and un-checking takes it back.
 * `state.xp` holds that running total. Your stage is simply where the total falls on the ladder below.
 */
export interface Stage {
  id: string
  title: string
  /** How the stage is introduced: "The Builder". */
  persona: string
  /** XP needed to enter this stage. */
  min: number
  /** What the stage means, in a sentence. */
  meaning: string
}

export const STAGES: Stage[] = [
  { id: 'rookie', title: 'Rookie', persona: 'Rookie', min: 0, meaning: "You've started. The first step is simply showing up." },
  { id: 'awakened', title: 'Awakened', persona: 'Awakened', min: 50, meaning: "You're becoming aware of your habits, weaknesses and potential." },
  { id: 'initiate', title: 'Initiate', persona: 'Initiate', min: 120, meaning: "You're learning to take consistent action." },
  { id: 'apprentice', title: 'Apprentice', persona: 'Apprentice', min: 215, meaning: "You're building your foundations and learning how to improve." },
  { id: 'disciplined', title: 'Disciplined', persona: 'Disciplined', min: 345, meaning: "You're beginning to do things even when motivation isn't there." },
  { id: 'dedicated', title: 'Dedicated', persona: 'Dedicated', min: 525, meaning: "Consistency is becoming part of your routine." },
  { id: 'striver', title: 'Striver', persona: 'Striver', min: 775, meaning: "You're actively pushing beyond your previous limits." },
  { id: 'builder', title: 'Builder', persona: 'Builder', min: 1125, meaning: "You're constructing systems, skills and habits that compound." },
  { id: 'focused', title: 'Focused', persona: 'Focused', min: 1600, meaning: "You're learning to eliminate distractions and prioritize what matters." },
  { id: 'driven', title: 'Driven', persona: 'Driven', min: 2250, meaning: "Your goals are starting to influence your everyday decisions." },
  { id: 'achiever', title: 'Achiever', persona: 'Achiever', min: 3175, meaning: "You're consistently turning intentions into measurable results." },
  { id: 'veteran', title: 'Veteran', persona: 'Veteran', min: 4425, meaning: "You've built enough experience to understand what works for you." },
  { id: 'elite', title: 'Elite', persona: 'Elite', min: 6150, meaning: "Your consistency and execution are becoming exceptional." },
  { id: 'mastermind', title: 'Mastermind', persona: 'Mastermind', min: 8525, meaning: "You think strategically about your time, goals and growth." },
  { id: 'pioneer', title: 'Pioneer', persona: 'Pioneer', min: 11800, meaning: "You're no longer simply following routines—you're creating your own path." },
  { id: 'unstoppable', title: 'Unstoppable', persona: 'Unstoppable', min: 16400, meaning: "Setbacks don't easily break your momentum anymore." },
  { id: 'ascendant', title: 'Ascendant', persona: 'Ascendant', min: 22600, meaning: "You're operating at a level significantly beyond where you started." },
  { id: 'transcendent', title: 'Transcendent', persona: 'Transcendent', min: 31300, meaning: "Your growth has become part of your identity." },
  { id: 'legend', title: 'Legend', persona: 'Legend', min: 43200, meaning: "You've built a history of sustained achievement and resilience." },
  { id: 'conqueror', title: 'Conqueror', persona: 'Conqueror', min: 60000, meaning: "You've mastered the journey, not because there's nothing left to achieve, but because you've learned how to continually evolve." },
]

/** Rank badge artwork for a level (0-based), served from public/badges. */
export const badgeSrc = (i: number) => `${import.meta.env.BASE_URL}badges/${String(i + 1).padStart(2, '0')}.png`

/** Where an XP total falls on the ladder. The Profile page and the Evolution page both read the rank from here. */
export function stageInfo(xp: number) {
  const index = STAGES.reduce((at, st, i) => (xp >= st.min ? i : at), 0)
  const stage = STAGES[index]
  const next = STAGES[index + 1] ?? null
  const pct = next ? Math.min(100, Math.round(((xp - stage.min) / (next.min - stage.min)) * 100)) : 100
  return { index, level: index + 1, stage, title: stage.title, next, pct, toNext: next ? next.min - xp : 0 }
}

export interface GrowthArea {
  id: string
  label: string
  /** Plain-language description of what feeds the score. */
  basis: string
  cats: CatId[] | null
  /** Completion over the last 30 days, 0 to 100; null when nothing was scheduled. */
  score: number | null
  /** Change in points against the 30 days before; null without enough data. */
  delta: number | null
  /** Check-ins ever made in this area. */
  total: number
  habits: number
  possible: number
}

export interface Achievement {
  id: string
  title: string
  detail: string
  icon: 'flame' | 'check' | 'goal' | 'calendar' | 'habits' | 'leaf' | 'bulb' | 'analytics'
  unlocked: boolean
  /** Date it was earned, when the history allows one. */
  on: Date | null
  /** Progress towards it while locked. */
  have: number
  need: number
}

export interface GoalView {
  goal: Goal
  current: number
  pct: number
  done: boolean
  habit: Task | null
  /** The goal links to a habit that has since been deleted. */
  orphaned: boolean
  color: string
  /** Ambition goals: the numbers behind the journey. For count goals `support` is empty and `steps.total` is 0. */
  steps: { done: number; total: number }
  /** True when progress can be shown as a percentage (a count goal, or an ambition with steps). */
  measurable: boolean
  /** Habits that feed an ambition, with check-ins since the goal began and in the last 7 days. */
  support: { habit: Task; total: number; week: number }[]
  supportTotal: number
  supportWeek: number
  /** Days since the goal began (1 on the first day). */
  daysIn: number
  /** Days until the deadline (negative once passed); null without one. */
  daysLeft: number | null
}

export interface Evolution {
  xp: number
  stage: number
  next: Stage | null
  /** 0 to 100 within the current stage. */
  progress: number
  toNext: number
  checkInsToNext: number
  /** Recent check-ins per day, used for the pace estimate. */
  pace: number
  daysToNext: number | null
  startedOn: Date | null
  streak: number
  totalCheckIns: number
  reached: (Date | null)[]
  areas: GrowthArea[]
  goals: GoalView[]
  achievements: Achievement[]
  records: { longestStreak: number; bestWeek: number; bestWeekOf: Date | null }
  insight: string[]
  hasHistory: boolean
}

import { weekStartIndex } from './preferences'

const DAY_MS = 86400000
const MIN_DAYS_FOR_INSIGHT = 7
const parseKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m, d) }
const mondayOf = (d: Date) => addDays(d, -((d.getDay() - weekStartIndex() + 7) % 7))
const plural = (n: number, w: string) => `${n.toLocaleString('en-US')} ${w}${n === 1 ? '' : 's'}`
const GOAL_FALLBACK = '#64e8d3'

export const AREAS: { id: string; label: string; basis: string; cats: CatId[] | null }[] = [
  { id: 'academics', label: 'Academics', basis: 'Learning habits', cats: ['learning'] },
  { id: 'fitness', label: 'Fitness', basis: 'Health habits', cats: ['health'] },
  { id: 'skills', label: 'Skills', basis: 'Productivity habits', cats: ['productivity'] },
  { id: 'discipline', label: 'Discipline', basis: 'Days you showed up', cats: null },
  { id: 'personal', label: 'Personal', basis: 'Mindset and lifestyle habits', cats: ['mindset', 'lifestyle'] },
]

/**
 * Progress of one goal.
 * Count goal: a typed-in number, or the check-ins of one linked habit since the goal was created.
 * Ambition: the share of its steps that are done. Without steps there is no percentage; the journey is
 * shown through the habits that feed it and the days spent on it, and the goal is finished by hand.
 */
export function goalView(s: AppState, goal: Goal, now: Date = new Date()): GoalView {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const daysIn = Math.max(1, Math.round((today - goal.createdAt) / DAY_MS) + 1)
  const daysLeft = goal.deadline ? Math.round((goal.deadline - today) / DAY_MS) : null
  const weekAgo = today - 6 * DAY_MS

  if (goal.kind === 'ambition') {
    const support = goal.habitIds
      .map(id => s.tasks.find(t => t.id === id))
      .filter((t): t is Task => !!t)
      .map(habit => {
        let total = 0, week = 0
        for (const [k, c] of Object.entries(s.completions)) {
          if (!c[habit.id]) continue
          const at = parseKey(k).getTime()
          if (at >= goal.createdAt) total++
          if (at >= weekAgo && at <= today) week++
        }
        return { habit, total, week }
      })
    const total = goal.milestones.length
    const done = goal.milestones.filter(m => m.doneAt).length
    const finished = !!goal.achievedAt || (total > 0 && done === total)
    const color = goal.color ?? '#f0b45a'
    return {
      goal, current: done, color, habit: null, orphaned: false,
      pct: total ? Math.round((done / total) * 100) : finished ? 100 : 0,
      done: finished,
      steps: { done, total }, measurable: total > 0, support,
      supportTotal: support.reduce((n, x) => n + x.total, 0),
      supportWeek: support.reduce((n, x) => n + x.week, 0),
      daysIn, daysLeft,
    }
  }

  const habit = goal.habitId ? s.tasks.find(t => t.id === goal.habitId) ?? null : null
  let current = goal.current
  if (goal.habitId) {
    current = 0
    for (const [k, c] of Object.entries(s.completions)) if (c[goal.habitId] && parseKey(k).getTime() >= goal.createdAt) current++
  }
  const color = goal.color ?? (habit ? CATS.find(c => c.id === habit.catId)?.color : undefined) ?? GOAL_FALLBACK
  return {
    goal, current, color, habit,
    orphaned: !!goal.habitId && !habit,
    pct: Math.min(100, Math.round((current / goal.target) * 100)),
    done: current >= goal.target,
    steps: { done: 0, total: 0 }, measurable: true, support: [], supportTotal: 0, supportWeek: 0,
    daysIn, daysLeft,
  }
}

export function buildEvolution(s: AppState, now: Date): Evolution {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const catOf = new Map(s.tasks.map(t => [t.id, t.catId]))

  // One pass over the history: check-ins per day, per category and per habit.
  const perDay: { date: Date; done: number; cats: Set<CatId> }[] = []
  const perHabit = new Map<string, number>()
  const catTotals = new Map<CatId, number>()
  for (const [k, c] of Object.entries(s.completions)) {
    const ids = Object.keys(c).filter(id => c[id])
    if (!ids.length) continue
    const date = parseKey(k)
    const cats = new Set<CatId>()
    for (const id of ids) {
      perHabit.set(id, (perHabit.get(id) ?? 0) + 1)
      const cat = catOf.get(id)
      if (cat) { cats.add(cat); catTotals.set(cat, (catTotals.get(cat) ?? 0) + 1) }
    }
    perDay.push({ date, done: ids.length, cats })
  }
  perDay.sort((a, b) => a.date.getTime() - b.date.getTime())
  const totalCheckIns = perDay.reduce((n, d) => n + d.done, 0)
  const firstTask = s.tasks.reduce((m, t) => Math.min(m, t.createdAt), Infinity)
  const startedOn = Number.isFinite(firstTask) ? new Date(firstTask) : perDay[0]?.date ?? null

  // Stage and progress inside it.
  const xp = s.xp
  const stage = STAGES.reduce((at, st, i) => (xp >= st.min ? i : at), 0)
  const next = STAGES[stage + 1] ?? null
  const span = next ? next.min - STAGES[stage].min : 1
  const progress = next ? Math.min(100, Math.round(((xp - STAGES[stage].min) / span) * 100)) : 100
  const toNext = next ? next.min - xp : 0
  const checkInsToNext = Math.ceil(toNext / XP_PER_TASK)

  // Pace: check-ins per day over the last 14 days (or since you started, if that is shorter).
  const since = new Date(Math.max(addDays(today, -13).getTime(), startedOn ? startOfDay(startedOn) : today.getTime()))
  const paceDays = Math.max(1, Math.round((today.getTime() - since.getTime()) / DAY_MS) + 1)
  const recent = perDay.filter(d => d.date >= since).reduce((n, d) => n + d.done, 0)
  const pace = recent / paceDays
  const daysToNext = next && pace > 0 ? Math.max(1, Math.ceil(checkInsToNext / pace)) : null

  // When each stage was reached: walk the check-ins in order and note where the running XP crosses each threshold.
  // Only shown if the history fully explains the XP total, otherwise the dates could be wrong.
  const explained = totalCheckIns * XP_PER_TASK === xp
  const reached: (Date | null)[] = STAGES.map((st, i) => (i === 0 ? startedOn : null))
  if (explained) {
    let run = 0
    for (const d of perDay) {
      run += d.done * XP_PER_TASK
      STAGES.forEach((st, i) => { if (i > 0 && reached[i] === null && run >= st.min) reached[i] = d.date })
    }
  }

  // Growth areas from the last 30 days, compared with the 30 before.
  const curFrom = addDays(today, -29), prevFrom = addDays(today, -59), prevTo = addDays(today, -30)
  const area = (cats: CatId[] | null, from: Date, to: Date) => {
    let done = 0, possible = 0
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const ts = tasksOn(s, d).filter(t => !cats || cats.includes(t.catId))
      possible += ts.length
      done += ts.filter(t => habitDone(s, t, d)).length
    }
    return { done, possible }
  }
  // Discipline is about showing up at all: the share of days with something scheduled on which you checked in at least once.
  const showUp = (from: Date, to: Date) => {
    let days = 0, shown = 0
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const ts = tasksOn(s, d)
      if (!ts.length) continue
      days++
      if (ts.some(t => habitDone(s, t, d))) shown++
    }
    return { done: shown, possible: days }
  }
  const active = s.tasks.filter(isHabit)
  const areas: GrowthArea[] = AREAS.map(a => {
    const cur = a.cats ? area(a.cats, curFrom, today) : showUp(curFrom, today)
    const prev = a.cats ? area(a.cats, prevFrom, prevTo) : showUp(prevFrom, prevTo)
    const rate = (x: { done: number; possible: number }) => Math.round((x.done / x.possible) * 100)
    return {
      ...a,
      score: cur.possible ? rate(cur) : null,
      delta: cur.possible >= 3 && prev.possible >= 3 ? rate(cur) - rate(prev) : null,
      total: a.cats ? a.cats.reduce((n, c) => n + (catTotals.get(c) ?? 0), 0) : totalCheckIns,
      habits: a.cats ? active.filter(t => a.cats!.includes(t.catId)).length : active.length,
      possible: cur.possible,
    }
  })

  // Streaks and the best week, scanning every day from the start.
  let run = 0, longestStreak = 0, maxWeekCats = 0
  let bestWeek = 0, bestWeekOf: Date | null = null
  let perfectWeek: Date | null = null, balancedWeek: Date | null = null
  let comeback: Date | null = null
  const streakDates: Record<number, Date | null> = { 7: null, 30: null }
  let silent = 0
  if (startedOn) {
    const weekDone = new Map<number, { n: number; full: boolean; days: number; cats: Set<CatId> }>()
    for (let d = new Date(startOfDay(startedOn)); d <= today; d = addDays(d, 1)) {
      const ts = tasksOn(s, d)
      const done = ts.filter(t => habitDone(s, t, d)).length
      const full = ts.length > 0 && done === ts.length
      if (ts.length) {
        if (full) { run++; longestStreak = Math.max(longestStreak, run); for (const n of [7, 30]) if (run === n && !streakDates[n]) streakDates[n] = d }
        else if (d.getTime() < today.getTime()) run = 0
        // A comeback: checking in again after at least three scheduled days with nothing done.
        if (done > 0) { if (silent >= 3 && !comeback) comeback = d; silent = 0 } else if (d.getTime() < today.getTime()) silent++
      }
      const wk = mondayOf(d).getTime()
      const w = weekDone.get(wk) ?? { n: 0, full: true, days: 0, cats: new Set<CatId>() }
      if (ts.length) {
        w.days++
        w.n += done
        if (!full) w.full = false
        for (const t of ts) if (habitDone(s, t, d)) w.cats.add(t.catId)
      }
      weekDone.set(wk, w)
    }
    for (const [wk, w] of weekDone) {
      const monday = new Date(wk)
      maxWeekCats = Math.max(maxWeekCats, w.cats.size)
      const ended = addDays(monday, 6).getTime() < today.getTime()
      if (w.n > bestWeek) { bestWeek = w.n; bestWeekOf = monday }
      if (ended && w.full && w.days >= 5 && !perfectWeek) perfectWeek = addDays(monday, 6)
      if (w.cats.size >= 4 && !balancedWeek) balancedWeek = monday
    }
  }

  // Goals and achievements. The running streak is the same one Home and Analytics show.
  const streak = currentStreak(s, now)
  longestStreak = Math.max(longestStreak, streak)
  const goals = s.goals.map(g => goalView(s, g, now)).sort((a, b) => Number(a.done) - Number(b.done) || b.pct - a.pct)
  const goalsDone = goals.filter(g => g.done).length
  const topHabit = [...perHabit.entries()].sort((a, b) => b[1] - a[1])[0]
  const nth = (n: number) => { let c = 0; for (const d of perDay) { c += d.done; if (c >= n) return d.date } return null }
  const mk = (id: string, title: string, detail: string, icon: Achievement['icon'], have: number, need: number, on: Date | null): Achievement =>
    ({ id, title, detail, icon, have: Math.min(have, need), need, unlocked: have >= need, on: have >= need ? on : null })
  const achievements: Achievement[] = [
    mk('first', 'First check-in', 'Completed your first habit.', 'check', totalCheckIns, 1, nth(1)),
    mk('c50', '50 check-ins', 'Fifty habits completed.', 'habits', totalCheckIns, 50, nth(50)),
    mk('c250', '250 check-ins', 'A quarter of a thousand, one at a time.', 'habits', totalCheckIns, 250, nth(250)),
    mk('c1000', '1,000 check-ins', 'A thousand habits completed.', 'habits', totalCheckIns, 1000, nth(1000)),
    mk('s7', '7-day streak', 'Every scheduled habit, seven days running.', 'flame', longestStreak, 7, streakDates[7]),
    mk('s30', '30-day streak', 'A full month without a gap.', 'flame', longestStreak, 30, streakDates[30]),
    mk('perfect', 'Perfect week', 'Every scheduled habit done across a full week.', 'calendar', perfectWeek ? 1 : 0, 1, perfectWeek),
    mk('balanced', 'Well rounded', 'Check-ins in four different categories in one week.', 'leaf', maxWeekCats, 4, balancedWeek),
    mk('regular', 'Regular', 'Thirty check-ins on a single habit.', 'bulb', topHabit?.[1] ?? 0, 30, null),
    mk('comeback', 'Comeback', 'Checked in again after three or more days away.', 'analytics', comeback ? 1 : 0, 1, comeback),
    mk('goal', 'Goal reached', 'Completed one of your goals.', 'goal', goalsDone, 1, null),
    mk('goals3', 'Three goals', 'Completed three goals.', 'goal', goalsDone, 3, null),
  ]

  // A short, honest reading of the data above. Nothing is said that the numbers do not support.
  const insight: string[] = []
  const tracked = perDay.length
  const cons = (from: Date, to: Date) => { const x = area(null, from, to); return x.possible >= 5 ? Math.round((x.done / x.possible) * 100) : null }
  const curC = cons(curFrom, today), prevC = cons(prevFrom, prevTo)
  if (tracked < MIN_DAYS_FOR_INSIGHT || curC === null) {
    insight.push('There is not enough history yet to say much. After about a week of check-ins, this section will describe what is working and what is not.')
  } else {
    if (prevC !== null && curC - prevC >= 3) insight.push(`Your consistency is up ${curC - prevC} points on the previous 30 days, now at ${curC}%.`)
    else if (prevC !== null && curC - prevC <= -3) insight.push(`Your consistency is down ${prevC - curC} points on the previous 30 days, now at ${curC}%.`)
    else insight.push(`Your consistency is steady at ${curC}% over the last 30 days.`)
    const scored = areas.filter(a => a.score !== null && a.possible >= 5 && a.cats).sort((a, b) => b.score! - a.score!)
    if (scored.length > 1 && scored[0].score! - scored[scored.length - 1].score! >= 10) {
      const hi = scored[0], lo = scored[scored.length - 1]
      insight.push(`${hi.label} is currently your strongest area at ${hi.score}%, while ${lo.label} needs more attention at ${lo.score}%.`)
    } else if (scored.length === 1) insight.push(`${scored[0].label} is the area you are tracking, at ${scored[0].score}%.`)
    if (next) insight.push(daysToNext !== null
      ? `At your recent pace of about ${pace.toFixed(1)} check-ins a day, ${next.persona} is roughly ${plural(daysToNext, 'day')} away.`
      : `You have no recent check-ins, so there is no pace to estimate yet. ${plural(checkInsToNext, 'check-in')} reaches ${next.persona}.`)
  }

  return {
    xp, stage, next, progress, toNext, checkInsToNext, pace, daysToNext, startedOn, streak, totalCheckIns, reached, areas, goals,
    achievements, records: { longestStreak, bestWeek, bestWeekOf }, insight, hasHistory: tracked > 0,
  }
}
