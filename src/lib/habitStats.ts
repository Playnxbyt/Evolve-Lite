import { dayKey, habitDone, isScheduledOn, startOfDay, tasksOn, type AppState, type Task } from './core'
import { weekStartIndex } from './preferences'

/**
 * Habit statistics, kept free of React so the rules live in one place.
 *
 * Counting rule:
 * The possible check-ins of a period are every day the habit is scheduled
 * within that period, starting from the habit's creation date.
 *
 * Days before the habit existed remain visible as `before` in the calendar,
 * but they are never included in possible check-ins, completion percentages,
 * streak calculations, or other habit statistics.
 */
export type CellState = 'done' | 'missed' | 'pending' | 'upcoming' | 'rest' | 'before'

export interface Cell {
  date: Date
  state: CellState
  today: boolean
}

export interface Tally {
  done: number
  possible: number
  missed: number
}

export interface HabitStat {
  t: Task
  week: Cell[]
  month: Cell[]
  w: Tally
  m: Tally
  run: number
  today: CellState
}

export const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** Recurring habits are tasks that have not been deleted. */
export const isHabit = (t: Task) =>
  (t as Task & { deletedAt?: number | null }).deletedAt == null

/** Monday to Sunday of the week containing `now`. */
export const daysOfWeek = (now: Date) =>
  Array.from(
    { length: 7 },
    (_, i) => addDays(now, i - ((now.getDay() - weekStartIndex() + 7) % 7))
  )

/** Every day of the month containing `now` (28 to 31 entries). */
export const daysOfMonth = (now: Date) =>
  Array.from(
    {
      length: new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).getDate(),
    },
    (_, i) => new Date(now.getFullYear(), now.getMonth(), i + 1)
  )

export function cellFor(
  s: AppState,
  t: Task,
  date: Date,
  now: Date
): Cell {
  const today = dayKey(date) === dayKey(now)

  /*
   * IMPORTANT:
   * Creation date is checked FIRST.
   *
   * This guarantees that a day before the habit was created can never
   * accidentally become "done", "missed", or "pending".
   */
  const state: CellState =
    startOfDay(date) < startOfDay(new Date(t.createdAt))
      ? 'before'
      : habitDone(s, t, date)
        ? 'done'
        : !isScheduledOn(t, date)
          ? 'rest'
          : today
            ? 'pending'
            : date > now
              ? 'upcoming'
              : 'missed'

  return { date, state, today }
}

/**
 * Calculates the possible check-ins for a period.
 *
 * `before` days are deliberately excluded.
 *
 * Example:
 * Habit created Oct 4
 * October has 31 calendar days
 * Possible days = Oct 4 through Oct 31 = 28 days
 *
 * So the UI correctly displays:
 * "1 of 28 days"
 * rather than:
 * "1 of 31 days"
 */
export const tally = (cells: Cell[]): Tally => ({
  done: cells.filter(c => c.state === 'done').length,

  possible: cells.filter(
    c => c.state !== 'rest' && c.state !== 'before'
  ).length,

  missed: cells.filter(c => c.state === 'missed').length,
})

export const sum = (ts: Tally[]): Tally =>
  ts.reduce(
    (a, t) => ({
      done: a.done + t.done,
      possible: a.possible + t.possible,
      missed: a.missed + t.missed,
    }),
    {
      done: 0,
      possible: 0,
      missed: 0,
    }
  )

export const percent = ({ done, possible }: Tally) =>
  possible ? Math.round((done / possible) * 100) : 0

export function buildStat(
  s: AppState,
  t: Task,
  week: Date[],
  month: Date[],
  now: Date,
  run: number
): HabitStat {
  const wk = week.map(d => cellFor(s, t, d, now))
  const mo = month.map(d => cellFor(s, t, d, now))

  return {
    t,
    week: wk,
    month: mo,
    w: tally(wk),
    m: tally(mo),
    run,
    today: wk[(now.getDay() + 6) % 7].state,
  }
}

/**
 * Longest run of completed scheduled days in the last `lookback` days.
 * Unscheduled days neither extend nor break the run.
 *
 * Days before the habit was created are ignored.
 */
export function bestRun(
  s: AppState,
  t: Task,
  now: Date,
  lookback = 90
) {
  let run = 0
  let best = 0

  const created = startOfDay(new Date(t.createdAt))

  for (let k = lookback - 1; k >= 0; k--) {
    const d = addDays(now, -k)

    // Never count anything before the habit existed.
    if (startOfDay(d) < created) continue

    if (habitDone(s, t, d)) {
      best = Math.max(best, ++run)
    } else if (isScheduledOn(t, d) && k > 0) {
      run = 0
    }
  }

  return best
}

/** Longest run of days on which every scheduled habit was completed. */
export function bestFullDayRun(
  s: AppState,
  now: Date,
  lookback = 90
) {
  let run = 0
  let best = 0

  for (let k = lookback - 1; k >= 0; k--) {
    const d = addDays(now, -k)
    const ts = tasksOn(s, d)

    if (!ts.length) continue

    if (ts.every(t => habitDone(s, t, d))) {
      best = Math.max(best, ++run)
    } else if (k > 0) {
      run = 0
    }
  }

  return best
}

/**
 * Weekday with the highest completion rate over finished days.
 * Returns null until there is enough data.
 */
export function strongestWeekday(
  s: AppState,
  habits: Task[],
  now: Date,
  weeks = 8
) {
  const by = Array.from(
    { length: 7 },
    () => ({
      done: 0,
      possible: 0,
    })
  )

  for (let k = 1; k <= weeks * 7; k++) {
    const d = addDays(now, -k)

    for (const t of habits) {
      const st = cellFor(s, t, d, now).state

      /*
       * Only completed or genuinely missed scheduled days count.
       * "before", "rest", "pending", and "upcoming" are ignored.
       */
      if (st === 'done' || st === 'missed') {
        by[d.getDay()].possible++

        if (st === 'done') {
          by[d.getDay()].done++
        }
      }
    }
  }

  const best = by
    .map((x, weekday) => ({
      weekday,
      pct:
        x.possible >= 4
          ? Math.round((x.done / x.possible) * 100)
          : -1,
    }))
    .sort((a, b) => b.pct - a.pct)[0]

  return best.pct > 0 ? best : null
}