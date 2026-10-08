import { useEffect, useRef, useState } from 'react'
import { catOf, dueReminders, loadFired, saveFired, type CalEvent, type Due } from '../lib/calendarEvents'
import { dayKey, tasksOn, type AppState } from '../lib/core'
import { Icon } from './Icons'
import { loadPreferences } from '../lib/preferences'
import { isNativeApp, scheduleNativeReminders } from '../lib/nativeReminders'

const CHECK_MS = 15000
const SHOW_MS = 20000

function Toast({ due, onClose }: { due: Due; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, SHOW_MS); return () => clearTimeout(t) }, [onClose])
  return (
    <div role="status" className="toast-in flex gap-3 rounded-xl border border-white/10 bg-panel/95 p-3.5 shadow-xl shadow-black/40 backdrop-blur">
      <span aria-hidden="true" className="mt-0.5 h-9 w-1 shrink-0 rounded-full" style={{ backgroundColor: catOf(due.catId).color }} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-ink/55"><Icon name="bell" className="size-3" />Reminder</p>
        <p className="mt-0.5 truncate font-medium">{due.title}</p>
        <p className="text-xs text-ink/65">{due.body}</p>
      </div>
      <button type="button" onClick={onClose} aria-label="Dismiss reminder" className="grid size-9 shrink-0 place-items-center rounded-lg text-ink/60 transition-colors hover:bg-white/[0.06] hover:text-ink">
        <Icon name="close" className="size-4" />
      </button>
    </div>
  )
}

/**
 * Fires reminders while EVOLVE is open: an in-app toast, plus a system notification when the user allowed them.
 * Fired reminders are remembered so a refresh never repeats one.
 */
export default function ReminderToasts({ events, state }: { events: CalEvent[]; state: AppState }) {
  const [toasts, setToasts] = useState<Due[]>([])
  const latest = useRef(events)
  latest.current = events
  const latestState = useRef(state)
  latestState.current = state

  useEffect(() => {
    const check = () => {
      const prefs = loadPreferences()
      if (!prefs.notifications) return
      const fired = new Set(loadFired())
      const now = new Date()
      const due = prefs.eventReminders ? dueReminders(latest.current, now, fired) : []
      if (prefs.habitReminders) {
        const nowMin = now.getHours() * 60 + now.getMinutes()
        for (const task of tasksOn(latestState.current, now)) {
          if (!task.time) continue
          // Fire within 15 minutes after the set time, so a throttled or just-reopened app (phones do this) still reminds you.
          const [h, m] = task.time.split(':').map(Number)
          const late = nowMin - (h * 60 + m)
          if (!Number.isFinite(late) || late < 0 || late > 15) continue
          const key = `habit|${dayKey(now)}|${task.id}|${task.time}`
          if (fired.has(key) || latestState.current.completions[dayKey(now)]?.[task.id]) continue
          fired.add(key)
          due.push({ key, title: task.text, body: 'Habit reminder · time to check in', start: now.getTime(), catId: task.catId === 'productivity' || task.catId === 'learning' ? 'professional' : 'personal' })
        }
      }
      if (!due.length) return
      due.forEach(d => fired.add(d.key))
      saveFired([...fired])
      setToasts(t => [...t, ...due])
      if (!isNativeApp() && prefs.systemNotifications && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        // Android Chrome throws on `new Notification()`; going through the service worker works there and on desktop.
        const show = async (d: Due) => {
          const opts = { body: d.body, tag: d.key, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' }
          try {
            const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
            if (reg) await reg.showNotification(d.title, opts)
            else new Notification(d.title, opts)
          } catch { /* unsupported context */ }
        }
        due.forEach(d => { void show(d) })
      }
    }
    check()
    const i = setInterval(check, CHECK_MS)
    return () => clearInterval(i)
  }, [events])

  // In the Android app, reminders are also registered with the phone's alarm system so they fire with the app closed.
  useEffect(() => {
    if (!isNativeApp()) return
    const sync = () => { void scheduleNativeReminders(latest.current, latestState.current, loadPreferences()) }
    sync()
    const i = setInterval(sync, 60000)
    return () => clearInterval(i)
  }, [events, state])

  if (!toasts.length) return null
  return (
    <div className="fixed right-4 top-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map(d => <Toast key={d.key} due={d} onClose={() => setToasts(t => t.filter(x => x.key !== d.key))} />)}
    </div>
  )
}
