import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import {
  PRIORITY_RANK, catById, dayKey, dayPct, habitStreak, insight, streak, tasksOn, weekDots,
  type AppState, type HabitFields, type Task,
} from '../lib/core'
import { Icon } from './Icons'
import Collapse from './Collapse'
import { setMotion } from '../lib/motion'
import SmoothHeight from './SmoothHeight'
import { LiveClock } from './DigitalClock'
import { RingArc, RingValue } from './RingProgress'
import { isTouchDevice } from '../lib/device'
import { useShell } from '../lib/shell'
import HeroSettingsModal, { type CustomTab } from './HeroSettingsModal'
import LiveScene from './LiveScene'
import WallpaperModal from './WallpaperModal'
import type { SceneSettings, Wallpaper } from '../lib/wallpaper'
import { DEFAULT_RING_LABEL, useHeroPrefs } from '../lib/heroPrefs'
import { FOCUS_EVENT, NOTES_EVENT, QUICK_EVENT, focusRequest } from './QuickActions'
import Switch from './Switch'
import TopBar from './TopBar'
import type { Tab } from './Sidebar'

interface Props {
  state: AppState
  wall: Wallpaper | null
  scene: SceneSettings
  onSetScene: (patch: Partial<SceneSettings>) => void
  onSetWallFile: (f: File) => Promise<string | null>
  onClearWall: () => void
  onToggle: (id: string) => void
  onAdd: (fields: HabitFields) => void
  onRemove: (id: string) => void
  onSetName: (name: string) => void
  onNavigate: (tab: Tab) => void
}
type Status = 'done' | 'active' | 'due' | 'upcoming' | 'todo'
type ModalKind = 'wall' | 'custom'
interface Session { taskId: string; endsAt: number; total: number }
interface Note { id: string; text: string; at: number }

const RING_R = 118
const CIRC = 2 * Math.PI * RING_R
const IMG_KEY = 'evolveRingImage', FOCUS_KEY = 'evolveFocus', NOTES_KEY = 'evolveNotes'
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const LABEL: Record<Status, string> = { done: 'Complete', active: 'In progress', due: 'Due', upcoming: 'Upcoming', todo: 'To do' }
const TONE: Record<Status, string> = {
  done: 'text-teal/80', active: 'bg-blue/15 text-blue', due: 'bg-lifestyle/15 text-lifestyle', upcoming: 'text-muted', todo: 'text-muted',
}
const QUOTES = [
  'Small steps every day lead to big results.',
  'Discipline today, freedom tomorrow.',
  'Better choices, bigger tomorrow.',
  'A little progress each day adds up.',
  "Keep going. You're closer than you think.",
]
const pad = (n: number) => String(n).padStart(2, '0')
const toMin = (t?: string) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null)
const mmss = (ms: number) => { const s = Math.ceil(ms / 1000); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}` }
const read = <T,>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback }
}
const write = (key: string, v: unknown) => {
  try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)) } catch { /* storage blocked or full */ }
}
const eyebrow = 'text-[11px] font-medium uppercase tracking-[0.18em]'

export default function Home({ state, wall, scene, onSetScene, onSetWallFile, onClearWall, onToggle, onAdd, onRemove, onSetName }: Props) {
  const [now, setNow] = useState(() => new Date())
  const { clock: clockPrefs, ring, setClock, setRing, resetClock, resetRing } = useHeroPrefs()
  const [stored, setStored] = useState<Session | null>(() => read<Session | null>(FOCUS_KEY, null))
  // In Minimal visuals the page only re-renders every second when seconds or a focus countdown are on screen.
  const minimal = useShell()?.prefs.visuals === 'minimal'
  // The clock ticks on its own (<LiveClock>), so the whole page only needs a 1s heartbeat while a focus countdown runs.
  // On phones that is the only time it ticks every second; otherwise every 15s keeps the dial and lists fresh.
  const lazyTick = minimal || isTouchDevice()
  const tickMs = !lazyTick || stored ? 1000 : 15000
  useEffect(() => { const i = setInterval(() => setNow(new Date()), tickMs); return () => clearInterval(i) }, [tickMs])
  // Analog hands: angles keep growing from where the real clock was on mount, so they glide past 12 instead of rewinding.
  const [dial0] = useState(() => {
    const d = new Date()
    return { t: d.getTime(), min: (d.getMinutes() + d.getSeconds() / 60) * 6, hr: ((d.getHours() % 12) + d.getMinutes() / 60) * 30 }
  })
  const minDeg = dial0.min + ((now.getTime() - dial0.t) / 60000) * 6
  const hrDeg = dial0.hr + ((now.getTime() - dial0.t) / 3600000) * 30

  const tasks = tasksOn(state, now)
  const done = state.completions[dayKey(now)] ?? {}
  const isDone = (t: Task) => !!done[t.id]
  const doneCount = tasks.filter(isDone).length
  const pct = dayPct(state, now)
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const [modal, setModal] = useState<ModalKind | null>(null)
  const [customTab, setCustomTab] = useState<CustomTab>('clock')
  const [menu, setMenu] = useState(false)
  const pillRef = useRef<HTMLDivElement>(null)
  const [choosing, setChoosing] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [allNotes, setAllNotes] = useState(false)
  const heroRef = useRef<HTMLElement>(null)
  useEffect(() => () => setMotion('home-hero', false), [])
  const [pinned, setPinned] = useState<string | null>(null)
  const [flipping, setFlipping] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>(() => read<Note[]>(NOTES_KEY, []))
  const session = stored && tasks.some(t => t.id === stored.taskId) ? stored : null
  const finished = useRef(false)
  const saveSession = (s: Session | null) => { setStored(s); write(FOCUS_KEY, s) }
  const saveNotes = (n: Note[]) => { setNotes(n); write(NOTES_KEY, n) }

  // The wallpaper pill opens a small menu; it closes on an outside press or Escape.
  useEffect(() => {
    if (!menu) return
    const away = (e: globalThis.PointerEvent) => { if (!pillRef.current?.contains(e.target as Node)) setMenu(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('pointerdown', away)
    window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc) }
  }, [menu])

  // A finished focus session completes its habit.
  useEffect(() => {
    if (session && now.getTime() >= session.endsAt && !finished.current) {
      finished.current = true
      if (!done[session.taskId]) onToggle(session.taskId)
      saveSession(null)
    }
  })

  // The ring and percentage ease to their value inside <RingArc>/<RingValue> (no page re-render per frame).

  // Custom picture inside the ring: resized to 640px and kept in this browser only.
  const [ringImg, setRingImg] = useState<string | null>(() => { try { return localStorage.getItem(IMG_KEY) } catch { return null } })
  const fileRef = useRef<HTMLInputElement>(null)
  const pickImage = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file), img = new Image()
    img.onload = () => {
      const S = 640, c = document.createElement('canvas')
      c.width = c.height = S
      const k = Math.max(S / img.width, S / img.height), w = img.width * k, h = img.height * k
      c.getContext('2d')!.drawImage(img, (S - w) / 2, (S - h) / 2, w, h)
      URL.revokeObjectURL(url)
      const data = c.toDataURL('image/jpeg', 0.82)
      try { localStorage.setItem(IMG_KEY, data); setRingImg(data) } catch { alert('That image could not be saved. Try a different one.') }
    }
    img.src = url
  }
  const resetImage = () => { try { localStorage.removeItem(IMG_KEY) } catch { /* ignore */ } setRingImg(null) }

  // Timeline order, status, and the single focus task.
  const status = (t: Task): Status => {
    const m = toMin(t.time)
    return isDone(t) ? 'done' : session?.taskId === t.id ? 'active' : m === null ? 'todo' : m <= nowMin ? 'due' : 'upcoming'
  }
  const sorted = [...tasks].sort((a, b) => (toMin(a.time) ?? 1e4) - (toMin(b.time) ?? 1e4) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
  const remaining = sorted.filter(t => !isDone(t))
  const highLeft = remaining.filter(t => t.priority === 'high').length
  const focusTask = (session && tasks.find(t => t.id === session.taskId)) ||
    remaining.find(t => t.id === pinned) ||
    [...remaining].sort((a, b) =>
      Number(status(b) === 'due') - Number(status(a) === 'due') ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      (toMin(a.time) ?? 1e4) - (toMin(b.time) ?? 1e4))[0]
  const pickList = [...remaining, ...sorted.filter(isDone)]
  // Light the orb first, then let the task leave the focus card once the animation has played.
  const flip = (t: Task) => {
    if (flipping) return
    if (t.id !== focusTask?.id || isDone(t)) { onToggle(t.id); return }
    setFlipping(t.id)
    window.setTimeout(() => { onToggle(t.id); setFlipping(null) }, 950)
  }
  const on = (t: Task) => isDone(t) || flipping === t.id
  // Let the list fold away first, then swap the focus task, so the two animations never fight each other.
  const choose = (id: string) => {
    if (session) return
    setChoosing(id)
    setOpen(false)
    window.setTimeout(() => { setPinned(id); setChoosing(null) }, 340)
  }
  const startFocus = () => {
    if (!focusTask) { window.dispatchEvent(new CustomEvent(QUICK_EVENT, { detail: 'habit' })); return }
    const total = (focusTask.duration ?? 25) * 60000
    finished.current = false
    saveSession({ taskId: focusTask.id, endsAt: Date.now() + total, total })
  }
  const left = session ? Math.max(0, session.endsAt - now.getTime()) : 0
  // The global quick-action button asks for focus (from any page) and adds notes; Home just reacts.
  const startRef = useRef(startFocus)
  startRef.current = startFocus
  useEffect(() => {
    if (focusRequest.pending) { focusRequest.pending = false; startRef.current() }
    const onFocus = () => startRef.current()
    const onNotes = () => setNotes(read<Note[]>(NOTES_KEY, []))
    window.addEventListener(FOCUS_EVENT, onFocus)
    window.addEventListener(NOTES_EVENT, onNotes)
    return () => { window.removeEventListener(FOCUS_EVENT, onFocus); window.removeEventListener(NOTES_EVENT, onNotes) }
  }, [])

  // Momentum and the one insight, both computed from real completions.
  // These look back over 4 weeks of days, so they are computed once per change to your data (or a new day), not on every tick or re-render.
  const today = dayKey(now)
  const { week, days, cur, delta, insightText } = useMemo(() => {
    const week = weekDots(state, now)
    const days = streak(state)
    const avg = (off: number) => {
      let sum = 0, n = 0
      for (let i = off; i < off + 7; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
        if (tasksOn(state, d).length) { sum += dayPct(state, d); n++ }
      }
      return n ? sum / n : null
    }
    const cur = avg(0), prev = avg(7)
    const delta = cur !== null && prev !== null ? Math.round(cur - prev) : null
    const byDay = DAYS.map(() => ({ s: 0, n: 0 }))
    for (let i = 0; i < 28; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      if (tasksOn(state, d).length) { byDay[d.getDay()].s += dayPct(state, d); byDay[d.getDay()].n++ }
    }
    const best = byDay.map((x, k) => ({ k, v: x.n >= 2 ? x.s / x.n : -1 })).sort((a, b) => b.v - a.v)[0]
    const insightText = best.v >= 50 ? `Your strongest day lately is ${DAYS[best.k]}, averaging ${Math.round(best.v)}% completion.` : insight(state, now)
    return { week, days, cur, delta, insightText }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, today])

  const hour = now.getHours()
  const statement = !tasks.length ? 'Nothing scheduled yet today.'
    : pct === 100 ? 'Everything is done. Well earned.'
    : highLeft ? `${highLeft} priorit${highLeft > 1 ? 'ies' : 'y'} left today.`
    : pct >= 50 ? "You're building momentum."
    : pct > 0 ? 'Good start. Keep the pace.'
    : 'A clean slate. Start with your focus.'
  const askName = () => {
    const n = window.prompt('What should I call you?', state.name)
    if (n && n.trim()) onSetName(n.trim().slice(0, 40))
  }
  const ago = (at: number) => {
    const m = Math.floor((now.getTime() - at) / 60000)
    return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`
  }
  // Parallax follows the pointer at most once per frame, and sits still while the card is resizing.
  const nudgeFrame = useRef(0)
  const nudge = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'touch' || isTouchDevice()) return
    const el = heroRef.current
    if (!el || nudgeFrame.current || el.hasAttribute('data-moving')) return
    const { clientX, clientY } = e
    nudgeFrame.current = requestAnimationFrame(() => {
      nudgeFrame.current = 0
      const r = el.getBoundingClientRect()
      el.style.setProperty('--px', String(((clientX - r.left) / r.width - 0.5) * 2))
      el.style.setProperty('--py', String(((clientY - r.top) / r.height - 0.5) * 2))
    })
  }
  // While the focus list opens or closes, the orb/pet loops are parked (see index.css). The wallpaper (video, live scene) keeps playing.
  const onMotion = (moving: boolean) => { heroRef.current?.toggleAttribute('data-moving', moving); setMotion('home-hero', moving) }
  const settle = () => { heroRef.current?.style.setProperty('--px', '0'); heroRef.current?.style.setProperty('--py', '0') }
  const delay = (n: number) => ({ animationDelay: `${n * 90}ms` })
  const btn = 'rounded-lg border border-white/10 px-3.5 py-2 text-sm transition-colors hover:border-teal/40 hover:text-teal'

  const date = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const quote = QUOTES[Math.floor(now.getTime() / 86400000) % QUOTES.length]
  const tile = (t: Task, size = 'size-9') => {
    const cat = catById(t.catId)
    return (
      <span className={`grid ${size} shrink-0 place-items-center rounded-xl`} style={{ backgroundColor: `${cat.color}1F`, color: cat.color }}>
        <Icon name={cat.icon} className="size-4" />
      </span>
    )
  }
  const upNext = remaining.filter(t => t.id !== focusTask?.id)
  const sub = (t: Task) => `${catById(t.catId).label}${t.time ? ` · ${t.time}` : ''}${t.duration ? ` · ${t.duration} min` : ''}`

  return (
    <div>
      <section ref={heroRef} onPointerMove={nudge} onPointerLeave={settle}
        className="hero-glass fade-up relative isolate overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/50" style={delay(0)}>
        {wall ? (
          wall.kind === 'video'
            ? <video src={wall.url} autoPlay muted loop playsInline aria-hidden="true" className="absolute inset-0 size-full object-cover" />
            : <img src={wall.url} alt="" className="wall-zoom absolute inset-0 size-full object-cover" />
        ) : <LiveScene theme={scene.theme} />}
        <div aria-hidden="true" className="absolute inset-0" style={{ backgroundColor: `rgba(3, 9, 14, ${scene.dim})` }} />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-black/45 via-transparent to-transparent" />

        <div className="relative p-5 pb-16 sm:p-8 sm:pb-16">
          <TopBar name={state.name}>
            <div className="[text-shadow:0_1px_14px_rgba(0,0,0,0.55)]">
              {clockPrefs.date && <p className="mb-1 text-sm text-ink/70">{date}</p>}
              <LiveClock prefs={clockPrefs} />
              <p className="mt-3 text-xl font-semibold">
                Good {hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'},{' '}
                <button onClick={askName} title="Change name" className="hover:text-teal">{state.name || 'there'}</button>
              </p>
              <p className="mt-1 max-w-xs text-sm text-ink/70">Progress isn&rsquo;t about being perfect, it&rsquo;s about showing up.</p>
            </div>
          </TopBar>

          <div className="grid items-start gap-8 md:grid-cols-[auto_minmax(0,1fr)] md:gap-10">
            <div className="flex flex-col items-center text-center">
              <div className="relative size-[230px] sm:size-[250px]">
                <div aria-hidden="true" className="absolute -inset-6 rounded-full bg-[radial-gradient(circle,rgba(61,220,151,0.14),transparent_70%)]" />
                <div className="absolute inset-[7.5%] overflow-hidden rounded-full bg-white/[0.07] shadow-[inset_0_0_36px_rgba(255,255,255,0.16)] ring-1 ring-white/25 backdrop-blur-xl">
                  {ringImg && <img src={ringImg} alt="" className="h-full w-full object-cover" />}
                  <div className={`absolute inset-0 ${ringImg ? 'bg-[radial-gradient(circle,rgba(3,9,14,0.7),rgba(3,9,14,0.1)_85%)]' : ''}`} />
                </div>
                <svg viewBox="0 0 260 260" className="absolute inset-0 size-full -rotate-90" role="img" aria-label={`${pct}% complete`}>
                  <defs>
                    <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3ddc97" /><stop offset="50%" stopColor="#2fd0c4" /><stop offset="100%" stopColor="#3b8cff" />
                    </linearGradient>
                  </defs>
                  <circle cx="130" cy="130" r={RING_R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="12" />
                  <RingArc pct={pct} r={RING_R} circ={CIRC} />
                </svg>
                <div aria-hidden="true" className="dial-hand hour" style={{ transform: `rotate(${hrDeg}deg)` }}><i /></div>
                <div aria-hidden="true" className="dial-hand minute" style={{ transform: `rotate(${minDeg}deg)` }}><i /></div>
                <div className="absolute inset-0 grid place-content-center [text-shadow:0_1px_12px_rgba(0,0,0,0.5)]">
                  <div className="font-display text-5xl font-medium tabular-nums tracking-tight"><RingValue pct={pct} /><span className="text-2xl text-ink/80">%</span></div>
                  <div className="mx-auto mt-1 max-w-[9.5rem] text-balance break-words text-center text-xs leading-tight text-ink/85">{ring.label.trim() || DEFAULT_RING_LABEL}</div>
                  {ring.count && <div className="mt-0.5 text-[11px] tabular-nums text-ink/70">{doneCount} / {tasks.length} completed</div>}
                </div>
              </div>
              <p className="mt-5 text-sm text-ink/75 [text-shadow:0_1px_10px_rgba(0,0,0,0.5)]">{statement}</p>
              <div className="mt-1 flex gap-1 text-xs text-ink/60">
                <button onClick={() => fileRef.current?.click()} className="rounded-md px-2 py-1.5 hover:text-teal">Change ring image</button>
                {ringImg && <button onClick={resetImage} className="rounded-md px-2 py-1.5 hover:text-teal">Reset</button>}
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { pickImage(e.target.files?.[0]); e.target.value = '' }} />
              </div>
            </div>

            <div className="space-y-4">
              <section className="glass liquid glass-live overflow-hidden rounded-2xl">
                <SmoothHeight onMotion={onMotion}>
                <button onClick={() => tasks.length && setOpen(o => !o)} aria-expanded={open} aria-controls="focus-list" disabled={!tasks.length}
                  className="block w-full rounded-t-2xl px-5 pb-1 pt-4 text-left transition-colors hover:bg-white/[0.03]">
                  <span className="flex items-center justify-between gap-3">
                    <span className={`${eyebrow} text-teal`}>Today&rsquo;s focus</span>
                    {tasks.length > 0 && (
                      <span className="flex items-center gap-2 text-xs text-ink/70">
                        <span aria-hidden={open || pickList.length < 2}
                          className={`overflow-hidden whitespace-nowrap rounded-full bg-white/10 py-0.5 transition-[max-width,opacity,padding] duration-300 ease-out ${!open && pickList.length > 1 ? 'max-w-24 px-2 opacity-100' : 'max-w-0 px-0 opacity-0'}`}>+{pickList.length - 1} more</span>
                        <span className="grid size-8 place-items-center rounded-full bg-white/10">
                          <Icon name="chevron" className={`size-4 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${open ? '-rotate-90' : 'rotate-90'}`} />
                        </span>
                      </span>
                    )}
                  </span>
                  {focusTask ? (
                    <span key={focusTask.id} className="swap mt-3 flex items-center gap-3 pb-3">
                      {tile(focusTask, 'size-11')}
                      <span className="min-w-0">
                        <span className="block truncate text-xl font-semibold leading-tight">{focusTask.text}</span>
                        <span className="block truncate text-sm text-ink/65">{sub(focusTask)}</span>
                      </span>
                    </span>
                  ) : (
                    <span className="swap mt-3 block pb-3">
                      <span className="block text-lg font-semibold">{tasks.length ? 'Nothing left today.' : 'Nothing planned yet.'}</span>
                      <span className="block text-sm text-ink/65">{tasks.length ? 'Everything is complete. Rest well.' : 'Add a habit or task to set your focus.'}</span>
                    </span>
                  )}
                </button>

                {focusTask && (
                  <div className="px-5 pb-4">
                    {session ? (
                      <div>
                        <div className="flex items-end justify-between">
                          <span className="text-3xl font-light tabular-nums">{mmss(left)}</span>
                          <button onClick={() => saveSession(null)} className={`${btn} text-ink/70`}>Stop</button>
                        </div>
                        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/15">
                          <div className="h-full rounded-full bg-gradient-to-r from-mint to-blue transition-[width] duration-1000 ease-linear" style={{ width: `${100 - (left / session.total) * 100}%` }} />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-ink/65">
                          {focusTask.duration ?? 25} min{focusTask.duration ? ' estimated' : ' session'}
                          {habitStreak(state, focusTask, now) > 0 && ` · ${habitStreak(state, focusTask, now)}-day streak`}
                        </p>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-xs text-ink/70">
                            Done<Switch key={focusTask.id} checked={on(focusTask)} onChange={() => flip(focusTask)} label={`Mark ${focusTask.text} done`} />
                          </label>
                          <button onClick={startFocus} className="flex items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90">
                            Start focus<Icon name="chevron" className="size-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                </SmoothHeight>

                <Collapse id="focus-list" open={open} onMotion={onMotion}>
                  <div className="fl-list" data-open={open}>
                    <ul className="max-h-72 space-y-1 overflow-y-auto overscroll-contain border-t border-white/10 px-3 py-3">
                      {pickList.map((t, i) => (
                        <li key={t.id} style={{ ['--i' as string]: Math.min(i, 8) }}
                          className={`fl-item flex items-center rounded-xl ${t.id === (choosing ?? focusTask?.id) ? 'bg-teal/10 ring-1 ring-teal/30' : 'hover:bg-white/[0.06]'}`}>
                          <button disabled={isDone(t) || !!session || t.id === focusTask?.id}
                            onClick={() => choose(t.id)}
                            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2.5 text-left disabled:cursor-default">
                            {tile(t, 'size-8')}
                            <span className="min-w-0 flex-1">
                              <span className={`block truncate text-sm transition-colors duration-300 ${isDone(t) ? 'text-ink/40 line-through' : ''}`}>{t.text}</span>
                              <span className="block truncate text-xs text-ink/60">{sub(t)}</span>
                            </span>
                            {t.id === (choosing ?? focusTask?.id) && <span className="text-[10px] font-medium uppercase tracking-wider text-teal">Focus</span>}
                          </button>
                          <div className="pr-3"><Switch checked={on(t)} onChange={() => flip(t)} label={`Mark ${t.text} done`} /></div>
                        </li>
                      ))}
                    </ul>
                    <p className="px-5 pb-3 text-xs text-ink/55">{session ? 'Stop the timer to switch focus.' : 'Tap a task to make it your focus.'}</p>
                  </div>
                </Collapse>
              </section>

              {notes.length > 0 && (
                <section aria-label="Quick notes" className="glass liquid note-in rounded-2xl p-4 sm:p-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className={`${eyebrow} text-teal`}>Quick notes</h2>
                    <span className="text-xs text-ink/60">{notes.length} saved</span>
                  </div>
                  <ul className="space-y-1">
                    {notes.slice(0, allNotes ? 30 : 3).map(n => (
                      <li key={n.id} className="note-in flex items-start gap-2 rounded-xl pl-3 hover:bg-white/[0.05]">
                        <span className="min-w-0 flex-1 py-2.5">
                          <span className="line-clamp-3 break-words text-sm text-ink/90">{n.text}</span>
                          <span className="text-[11px] text-ink/50">{ago(n.at)}</span>
                        </span>
                        <button onClick={() => saveNotes(notes.filter(x => x.id !== n.id))} aria-label="Delete note"
                          className="grid size-11 shrink-0 place-items-center rounded-xl text-ink/55 transition-colors hover:bg-red-400/15 hover:text-red-400">
                          <Icon name="close" className="size-[18px]" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {notes.length > 3 && (
                    <button onClick={() => setAllNotes(v => !v)} className="mt-1 rounded-lg px-2 py-2 text-xs text-ink/65 hover:text-teal">
                      {allNotes ? 'Show fewer' : `Show ${Math.min(notes.length, 30) - 3} more`}
                    </button>
                  )}
                </section>
              )}
            </div>
          </div>
        </div>

        <div ref={pillRef} className="absolute bottom-4 right-4 z-10">
          <ul role="menu" aria-label="Customize the hero card" inert={!menu}
            className={`glass liquid absolute bottom-full right-0 mb-2 w-44 origin-bottom-right rounded-2xl p-1.5 transition-[opacity,transform] duration-200 ease-out ${menu ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'}`}>
            {([
              { label: 'Wallpaper', icon: <Icon name="image" className="size-4 text-teal" />, run: () => setModal('wall') },
              { label: 'Clock', icon: <svg viewBox="0 0 24 24" className="size-4 text-teal" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>, run: () => { setCustomTab('clock'); setModal('custom') } },
              { label: 'Ring text', icon: <svg viewBox="0 0 24 24" className="size-4 text-teal" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 3.5a8.5 8.5 0 1 1-8.5 8.5" /><path d="M9 12h6" /></svg>, run: () => { setCustomTab('ring'); setModal('custom') } },
            ]).map(m => (
              <li key={m.label} role="none">
                <button role="menuitem" onClick={() => { setMenu(false); m.run() }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-white/10 hover:text-teal">
                  {m.icon}{m.label}
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => setMenu(o => !o)} aria-haspopup="menu" aria-expanded={menu}
            className="glass liquid flex items-center gap-2 rounded-full py-2 pl-3 pr-4 text-xs transition-colors hover:text-teal">
            <Icon name="image" className="size-4" />Wallpaper
          </button>
        </div>
      </section>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <section className="glass liquid fade-up rounded-2xl p-5 sm:p-6" style={delay(2)}>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className={`${eyebrow} text-ink/70`}>Today</h2>
            <span className="text-xs tabular-nums text-ink/60">{doneCount}/{tasks.length}</span>
          </div>
          {sorted.length === 0 && <p className="py-4 text-sm text-ink/60">Nothing scheduled. Use the + button to add a task or habit.</p>}
          <ul className="divide-y divide-white/10">
            {sorted.map(t => {
              const st = status(t)
              return (
                <li key={t.id} className="group grid grid-cols-[2.75rem_auto_minmax(0,1fr)_auto] items-center gap-x-3 py-2.5">
                  <span className="text-sm tabular-nums text-ink/60">{t.time ?? '—'}</span>
                  {tile(t)}
                  <div className="min-w-0">
                    <p className={`truncate text-[15px] transition-colors duration-300 ${on(t) ? 'text-ink/40 line-through' : ''}`}>{t.text}</p>
                    <p className="truncate text-xs text-ink/60">{catById(t.catId).label}{t.duration ? ` · ${t.duration} min` : ''}</p>
                  </div>
                  <span className="flex items-center gap-1 sm:gap-2">
                    <span className={`hidden rounded-md px-2 py-0.5 text-xs transition-colors sm:block ${TONE[on(t) ? 'done' : st]}`}>{LABEL[on(t) ? 'done' : st]}</span>
                    <button onClick={() => { if (confirm('Delete this from today onward?')) onRemove(t.id) }} aria-label={`Delete ${t.text}`}
                      className="grid size-9 place-items-center rounded-lg text-ink/55 transition-all hover:bg-red-400/15 hover:text-red-400 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <Icon name="close" className="size-4" />
                    </button>
                    <Switch checked={on(t)} onChange={() => flip(t)} label={`Mark ${t.text} done`} />
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="glass liquid fade-up rounded-2xl p-5 sm:p-6" style={delay(3)}>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className={`${eyebrow} text-ink/70`}>Weekly momentum</h2>
              <span className="flex items-center gap-1 text-xs text-ink/65"><Icon name="flame" className="size-3.5 text-orange-400" />{days} day streak</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {week.map((d, i) => {
                const fill = d.future || !d.hasTasks ? 0 : d.pct > 0 ? Math.max(d.pct, 12) : 0
                return (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div title={d.future || !d.hasTasks ? '' : `${d.pct}%`}
                      className={`relative h-20 w-full max-w-7 overflow-hidden rounded-full bg-white/[0.07] shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] ${d.isToday ? 'ring-1 ring-teal/60 ring-offset-2 ring-offset-transparent' : ''} ${d.future || !d.hasTasks ? 'border border-dashed border-white/15' : ''}`}>
                      <span className="bar-grow bar-fill absolute inset-x-0 bottom-0 rounded-full bg-gradient-to-t from-mint to-blue"
                        style={{ height: `${fill}%`, ['--i' as string]: i, boxShadow: d.pct === 100 && d.hasTasks ? '0 0 14px rgba(61,220,151,0.6)' : '0 0 0 rgba(61,220,151,0)' }} />
                    </div>
                    <span className={`text-[11px] ${d.isToday ? 'text-ink' : 'text-ink/55'}`}>{d.label}</span>
                  </div>
                )
              })}
            </div>
            {(delta !== null || cur !== null) && (
              <p className="mt-3 text-xs text-ink/60">{delta !== null ? `${delta > 0 ? '+' : ''}${delta}% vs last week` : `${Math.round(cur!)}% average this week`}</p>
            )}
            <p className="mt-4 flex gap-2.5 border-t border-white/10 pt-4 text-sm leading-relaxed text-ink/75">
              <Icon name="bulb" className="mt-0.5 size-4 shrink-0 text-lifestyle" />{insightText}
            </p>
          </section>

          <section className="fade-up relative isolate flex min-h-44 flex-col justify-between gap-5 overflow-hidden rounded-2xl border border-white/15 p-5 shadow-xl shadow-black/40 sm:p-6" style={delay(4)}>
            {wall && wall.kind === 'image'
              ? <img src={wall.url} alt="" className="absolute inset-0 size-full object-cover" />
              : !wall && <LiveScene theme={scene.theme} lite />}
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/25" />

            <div className="relative">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className={`${eyebrow} text-ink/80`}>Up next</h2>
                {upNext.length > 0 && <span className="text-xs tabular-nums text-ink/70">{remaining.length} left today</span>}
              </div>
              {upNext.length > 0 ? (
                <ul className="space-y-1.5">
                  {upNext.slice(0, 3).map(t => (
                    <li key={t.id}>
                      <button onClick={() => setPinned(t.id)} disabled={!!session} title={session ? 'Stop the timer to switch focus' : 'Make this your focus'}
                        className="flex w-full items-center gap-3 rounded-xl bg-black/25 px-2.5 py-2 text-left ring-1 ring-white/10 transition-colors enabled:hover:bg-white/10 disabled:cursor-default">
                        {tile(t, 'size-8')}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{t.text}</span>
                          <span className="block truncate text-xs text-ink/60">{sub(t)}</span>
                        </span>
                        <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] ${TONE[status(t)]}`}>{LABEL[status(t)]}</span>
                      </button>
                    </li>
                  ))}
                  {upNext.length > 3 && <li className="px-1 pt-0.5 text-xs text-ink/60">+{upNext.length - 3} more on today&rsquo;s list</li>}
                </ul>
              ) : (
                <p className="text-sm leading-relaxed text-ink/80">
                  {!tasks.length ? 'Nothing planned yet. Use the + button to add a habit or task.'
                    : remaining.length ? 'Your focus task is the last one left today.'
                    : 'Everything is done for today. Rest well.'}
                </p>
              )}
            </div>

            <p className="relative max-w-[18rem] text-sm font-medium leading-snug text-ink/90 [text-shadow:0_1px_12px_rgba(0,0,0,0.6)]">&ldquo;{quote}&rdquo;</p>
          </section>
        </div>
      </div>

      {modal === 'custom' && (
        <HeroSettingsModal tab={customTab} onTab={setCustomTab} now={now} clock={clockPrefs} ring={ring} pct={Math.round(pct)} done={doneCount} total={tasks.length}
          onClock={setClock} onRing={setRing} onResetClock={resetClock} onResetRing={resetRing} onClose={() => setModal(null)} />
      )}
      {modal === 'wall' && (
        <WallpaperModal theme={scene.theme} dim={scene.dim} blur={scene.blur} shade={scene.shade} custom={wall?.kind ?? null}
          onTheme={id => { onSetScene({ theme: id }); if (wall) onClearWall() }} onDim={v => onSetScene({ dim: v })}
          onBlur={v => onSetScene({ blur: v })} onShade={v => onSetScene({ shade: v })} onPreset={onSetScene}
          onFile={onSetWallFile} onClear={onClearWall} onClose={() => setModal(null)} />
      )}
    </div>
  )
}
