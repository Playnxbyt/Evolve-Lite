import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { catOf, ensureNotifyPermission, fmtRange, occurrencesBetween } from '../lib/calendarEvents'
import { dayKey, streak, tasksOn } from '../lib/core'
import { stageInfo } from '../lib/evolution'
import { isNativeApp, scheduleNativeReminders } from '../lib/nativeReminders'
import { useShell } from '../lib/shell'
import type { Tab } from './Sidebar'
import { Icon } from './Icons'

/** A floating panel under a button. Rendered in <body> so no card can clip it. Closes on outside tap, Esc, scroll and resize. */
function Popover({ anchor, onClose, label, children }: { anchor: RefObject<HTMLElement | null>; onClose: () => void; label: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  useLayoutEffect(() => {
    const r = anchor.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 10, right: Math.max(12, window.innerWidth - r.right) })
  }, [anchor])

  useEffect(() => {
    const down = (e: Event) => {
      const t = e.target as Node
      if (panel.current?.contains(t) || anchor.current?.contains(t)) return
      onClose()
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { onClose(); anchor.current?.focus() } }
    window.addEventListener('pointerdown', down)
    window.addEventListener('keydown', key)
    window.addEventListener('resize', onClose)
    window.addEventListener('scroll', onClose, true)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('keydown', key)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [anchor, onClose])

  if (!pos) return null
  return createPortal(
    <div
      ref={panel} role="dialog" aria-label={label}
      style={{ top: pos.top, right: pos.right }}
      className="pop-in fixed z-[70] w-80 max-w-[calc(100vw-1.5rem)] origin-top-right rounded-2xl border border-white/10 bg-panel/95 text-ink shadow-2xl shadow-black/60 backdrop-blur-xl max-sm:!left-3 max-sm:!right-3 max-sm:w-auto"
    >
      {children}
    </div>,
    document.body,
  )
}

const hhmmLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

interface Row { key: string; title: string; when: string; color: string; sort: number; icon: 'clock' | 'check' }

function useNow(ms: number) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const i = setInterval(() => setNow(new Date()), ms); return () => clearInterval(i) }, [ms])
  return now
}

export function BellMenu() {
  const shell = useShell()
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const now = useNow(60000)
  const [busy, setBusy] = useState(false)
  const t = now.getTime()

  const { rows, pending } = useMemo(() => {
    if (!shell) return { rows: [] as Row[], pending: 0 }
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    const endOfToday = tomorrow.getTime()
    const rows: Row[] = []
    for (const o of occurrencesBetween(shell.events, today, tomorrow)) {
      if (o.end <= t) continue
      const e = o.event, isToday = o.start < endOfToday
      rows.push({
        key: `e|${e.id}|${o.date}`, title: e.title, color: catOf(e.catId).color, icon: 'clock',
        when: `${isToday ? 'Today' : 'Tomorrow'} · ${e.allDay ? 'All day' : fmtRange(e)}`, sort: o.start + (e.allDay ? 0 : 1),
      })
    }
    const todays = tasksOn(shell.state, now).filter(x => !shell.state.completions[dayKey(now)]?.[x.id])
    for (const x of todays) {
      const [h, m] = (x.time || '').split(':').map(Number)
      const at = x.time && Number.isFinite(h) ? new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m).getTime() : endOfToday - 1
      rows.push({ key: `h|${x.id}`, title: x.text, color: '#64e8d3', icon: 'check', when: x.time ? `Today · ${hhmmLabel(x.time)} · habit` : 'Today · habit', sort: at })
    }
    rows.sort((a, b) => a.sort - b.sort)
    const pending = rows.filter(r => r.sort < endOfToday).length
    return { rows, pending }
  }, [shell, now, t])

  if (!shell) return null
  const { prefs, updatePrefs, events, state, go } = shell
  const alertsOn = prefs.notifications && prefs.systemNotifications
  const blocked = !isNativeApp() && typeof Notification !== 'undefined' && Notification.permission === 'denied'
  const unsupported = !isNativeApp() && typeof Notification === 'undefined'

  const turnOn = async () => {
    setBusy(true)
    updatePrefs({ notifications: true, systemNotifications: true })
    await ensureNotifyPermission()
    void scheduleNativeReminders(events, state, { ...prefs, notifications: true, systemNotifications: true })
    setBusy(false)
  }
  const close = () => setOpen(false)

  return (
    <>
      <button
        ref={btn} type="button" onClick={() => setOpen(o => !o)} aria-haspopup="dialog" aria-expanded={open}
        aria-label={pending ? `Notifications, ${pending} to do today` : 'Notifications'}
        className="relative grid size-10 place-items-center rounded-full text-ink/70 hover:bg-white/[0.07] hover:text-ink"
      >
        <Icon name="bell" className="size-[19px]" />
        {pending > 0 && (
          <span className="absolute right-1 top-1 grid min-w-[1.05rem] place-items-center rounded-full bg-teal px-1 text-[10px] font-bold leading-[1.05rem] text-bg">{pending > 9 ? '9+' : pending}</span>
        )}
      </button>
      {open && (
        <Popover anchor={btn} onClose={close} label="Notifications">
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <h3 className="text-sm font-semibold">Coming up</h3>
            <span className="text-[11px] text-ink/50">{pending ? `${pending} left today` : 'All clear today'}</span>
          </div>
          <ul className="max-h-[min(20rem,50vh)] overflow-y-auto px-2 pb-1">
            {rows.length === 0 && <li className="px-2 py-6 text-center text-sm text-ink/55">Nothing scheduled for today or tomorrow.</li>}
            {rows.slice(0, 8).map(r => (
              <li key={r.key} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-white/[0.05]">
                <span aria-hidden="true" className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.title}</span>
                  <span className="block truncate text-xs text-ink/55">{r.when}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-white/[0.07] p-3">
            {alertsOn ? (
              <p className="flex items-center gap-2 px-1 text-xs text-ink/60"><Icon name="check" className="size-3.5 text-teal" />Phone alerts are on. <button type="button" onClick={() => { close(); go('Profile') }} className="text-teal hover:underline">Manage</button></p>
            ) : blocked || unsupported ? (
              <p className="px-1 text-xs leading-relaxed text-ink/60">{blocked ? 'Alerts are blocked for this site. Allow notifications in your browser or phone settings, then try again.' : 'This browser cannot show system alerts. Install Evolve as an app to get them.'}</p>
            ) : (
              <button type="button" disabled={busy} onClick={turnOn} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal/90 px-3 py-2.5 text-sm font-semibold text-bg hover:bg-teal">
                <Icon name="bell" className="size-4" />Turn on phone alerts
              </button>
            )}
            <button type="button" onClick={() => { close(); go('Calendar') }} className="w-full rounded-xl px-3 py-2 text-sm text-ink/75 hover:bg-white/[0.06] hover:text-ink">Open calendar</button>
          </div>
        </Popover>
      )}
    </>
  )
}

export function ProfileMenu({ name }: { name: string }) {
  const shell = useShell()
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const initial = (name.trim()[0] ?? 'E').toUpperCase()
  if (!shell) return <div aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-panel text-sm font-semibold">{initial}</div>
  const { state, prefs, go } = shell
  const info = stageInfo(state.xp)
  const days = streak(state)
  const avatar = (size: string, text: string) => (
    <span className={`${size} shrink-0 rounded-full bg-gradient-to-br from-teal/80 to-blue/80 p-[1.5px]`}>
      {prefs.avatar
        ? <img src={prefs.avatar} alt="" className="size-full rounded-full object-cover" />
        : <span className={`grid size-full place-items-center rounded-full bg-panel font-semibold ${text}`}>{initial}</span>}
    </span>
  )
  const items: { tab: Tab; label: string; icon: 'profile' | 'evolution' | 'calendar' | 'habits' }[] = [
    { tab: 'Profile', label: 'Profile & settings', icon: 'profile' },
    { tab: 'Evolution', label: 'My evolution', icon: 'evolution' },
    { tab: 'Habits', label: 'My habits', icon: 'habits' },
    { tab: 'Calendar', label: 'Calendar', icon: 'calendar' },
  ]
  return (
    <>
      <button ref={btn} type="button" onClick={() => setOpen(o => !o)} aria-haspopup="dialog" aria-expanded={open} aria-label="Account menu" className="rounded-full">
        {avatar('block size-10', 'text-sm')}
      </button>
      {open && (
        <Popover anchor={btn} onClose={() => setOpen(false)} label="Account">
          <div className="flex items-center gap-3 p-4">
            {avatar('block size-12', 'text-base')}
            <div className="min-w-0">
              <p className="truncate font-semibold">{name.trim() || 'Add your name'}</p>
              <p className="truncate text-xs text-ink/60">Level {info.level} · {info.title}</p>
            </div>
          </div>
          <div className="px-4 pb-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-teal to-mint transition-[width] duration-700" style={{ width: `${info.pct}%` }} /></div>
            <div className="mt-2 flex justify-between text-[11px] text-ink/55">
              <span>{state.xp} XP{info.next ? ` · ${info.toNext} to ${info.next.title}` : ' · top level'}</span>
              <span>{days} day streak</span>
            </div>
          </div>
          <div className="border-t border-white/[0.07] p-2">
            {items.map(i => (
              <button key={i.tab} type="button" onClick={() => { setOpen(false); go(i.tab) }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-ink/85 hover:bg-white/[0.06] hover:text-ink">
                <Icon name={i.icon} className="size-[18px] text-ink/60" />{i.label}
              </button>
            ))}
          </div>
        </Popover>
      )}
    </>
  )
}
