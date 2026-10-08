import { Capacitor } from '@capacitor/core'
import { ALL_DAY_REMIND_HOUR, fmtRange, occurrencesBetween, type CalEvent } from './calendarEvents'
import { dayKey, tasksOn, type AppState } from './core'

/** True inside the installed Android app (Capacitor), false in a normal browser / PWA. */
export const isNativeApp = () => Capacitor.isNativePlatform()

const DAYS_AHEAD = 7
const MAX_PENDING = 60

// Android needs a 32-bit integer id per notification; derive a stable one from the reminder key.
const idOf = (key: string) => {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0) % 2147483647 || 1
}

/**
 * Hands the next week of reminders to Android's alarm system, so they fire at the exact time
 * even when the app is closed. Called whenever events, habits or settings change. Safe to call often.
 */
export async function scheduleNativeReminders(
  events: CalEvent[], state: AppState,
  prefs: { notifications: boolean; eventReminders: boolean; habitReminders: boolean; systemNotifications: boolean },
) {
  if (!isNativeApp()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) })
    if (!prefs.notifications || !prefs.systemNotifications) return

    let perm = await LocalNotifications.checkPermissions()
    if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') perm = await LocalNotifications.requestPermissions()
    if (perm.display !== 'granted') return

    const now = new Date(), t = now.getTime()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const horizon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + DAYS_AHEAD)
    const items: { id: number; title: string; body: string; at: number }[] = []

    if (prefs.eventReminders) {
      for (const o of occurrencesBetween(events.filter(e => e.reminder !== null), today, horizon)) {
        const e = o.event
        const base = e.allDay ? o.start + ALL_DAY_REMIND_HOUR * 3600000 : o.start
        const at = base - (e.reminder ?? 0) * 60000
        if (at > t) items.push({ id: idOf(`${e.id}|${o.date}|${e.reminder}`), title: e.title, body: fmtRange(e), at })
      }
    }
    if (prefs.habitReminders) {
      for (let i = 0; i <= DAYS_AHEAD; i++) {
        const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)
        for (const task of tasksOn(state, day)) {
          if (!task.time) continue
          if (state.completions[dayKey(day)]?.[task.id]) continue
          const [h, m] = task.time.split(':').map(Number)
          if (!Number.isFinite(h) || !Number.isFinite(m)) continue
          const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).getTime()
          if (at > t) items.push({ id: idOf(`habit|${dayKey(day)}|${task.id}|${task.time}`), title: task.text, body: 'Habit reminder · time to check in', at })
        }
      }
    }

    items.sort((a, b) => a.at - b.at)
    const batch = items.slice(0, MAX_PENDING)
    if (!batch.length) return
    await LocalNotifications.schedule({
      notifications: batch.map(n => ({
        id: n.id, title: n.title, body: n.body,
        schedule: { at: new Date(n.at), allowWhileIdle: true },
      })),
    })
  } catch { /* native scheduling is best-effort */ }
}
