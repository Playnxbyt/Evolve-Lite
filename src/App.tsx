import { Suspense, lazy, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { XP_PER_TASK, dayKey, loadState, saveState, startOfDay, type AppState, type Goal, type GoalFields, type HabitFields } from './lib/core'
import { DEFAULT_WALLPAPER, useSceneSettings, useWallpaper } from './lib/wallpaper'
import { usePreferences } from './lib/preferences'
import Home from './components/Home'
import { PageBoundary, PageSkeleton } from './components/PageStates'

// Only Home loads up front. Every other page loads on first visit (and is fetched in the background once the app is idle),
// so the first screen shows sooner and a phone parses far less JavaScript at start-up.
const loaders = {
  Habits: () => import('./components/Habits'),
  Analytics: () => import('./components/Analytics'),
  Calendar: () => import('./components/Calendar'),
  Spaces: () => import('./components/Spaces'),
  Evolution: () => import('./components/Evolution'),
  Profile: () => import('./components/Profile'),
}
const Habits = lazy(loaders.Habits)
const Analytics = lazy(loaders.Analytics)
const Calendar = lazy(loaders.Calendar)
const Spaces = lazy(loaders.Spaces)
const Evolution = lazy(loaders.Evolution)
const Profile = lazy(loaders.Profile)
import ReminderToasts from './components/ReminderToasts'
import { useEvents } from './lib/calendarEvents'
import Backdrop from './components/Backdrop'
import Sidebar, { type Tab } from './components/Sidebar'
import TopBar from './components/TopBar'
import LiquidGlass from './components/LiquidGlass'
import Pet from './components/Pet'
import QuickActions from './components/QuickActions'
import CommandPalette from './components/CommandPalette'
import { ShellContext } from './lib/shell'

const SIDEBAR_KEY = 'evolveSidebar'

export default function App() {
  const [state, setState] = useState<AppState>(loadState)
  const { prefs, update: updatePrefs, reset: resetPrefs } = usePreferences()
  const [tab, setTabNow] = useState<Tab>('Home')
  // The tapped tab lights up immediately; the page swaps in as a low-priority transition so the tap never feels blocked.
  const [shownTab, setShownTab] = useState<Tab>('Home')
  const setTab = useCallback((t: Tab) => {
    setTabNow(t)
    startTransition(() => setShownTab(t))
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === '1' } catch { return false }
  })
  // Wallpaper lives here so the whole page (not just the hero card) can pick it up.
  const { wall, setFile: saveFile, clear: clearFile } = useWallpaper()
  const [scene, setScene] = useSceneSettings()
  // Uploading selects the user's wallpaper; removing it falls back to the bundled default.
  const setFile = async (f: File) => {
    const err = await saveFile(f)
    if (!err) setScene({ bg: 'custom', live: false })
    return err
  }
  const clear = async () => {
    await clearFile()
    setScene({ bg: 'default' })
  }
  // live scene > "Evolve Wallpaper" (none) > own upload > bundled default video
  const appMedia = scene.live || scene.bg === 'evolve' ? null : scene.bg === 'custom' && wall ? wall : DEFAULT_WALLPAPER
  const cal = useEvents()

  // Saving serialises everything, so it waits for a short pause (a quick tap sequence saves once) and always flushes when the app is hidden or closed.
  const latest = useRef(state)
  latest.current = state
  useEffect(() => {
    const t = window.setTimeout(() => saveState(state), 350)
    return () => window.clearTimeout(t)
  }, [state])
  useEffect(() => {
    const flush = () => saveState(latest.current)
    const onVis = () => { if (document.hidden) flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVis)
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  // Warm up the other pages once Home has settled: one page at a time, each in an idle moment, so downloading and parsing
  // them can never land in the middle of Home's first animations or a tap.
  useEffect(() => {
    const w = window as typeof window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }
    const queue = Object.values(loaders)
    let timer = 0, idle = 0, dead = false
    const next = () => {
      if (dead) return
      const load = queue.shift()
      if (!load) return
      load().catch(() => { /* retried on first visit */ }).finally(() => { timer = window.setTimeout(schedule, 400) })
    }
    const schedule = () => {
      if (dead || !queue.length) return
      if (w.requestIdleCallback) idle = w.requestIdleCallback(next, { timeout: 3000 })
      else timer = window.setTimeout(next, 800)
    }
    timer = window.setTimeout(schedule, 3500)
    return () => { dead = true; window.clearTimeout(timer); if (idle) w.cancelIdleCallback?.(idle) }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = prefs.theme
    root.dataset.accent = prefs.accent
    root.dataset.density = prefs.density
    document.body.classList.toggle('effects-off', !prefs.backgroundEffects)
    // Evolve visuals: <html data-visuals> drives the CSS tiers; body.perf-lite is the Minimal tier's hook for older rules.
    root.dataset.visuals = prefs.visuals
    document.body.classList.toggle('perf-lite', prefs.visuals === 'minimal')
    if (prefs.visuals === 'extended') root.removeAttribute('data-scrolling')
  }, [prefs.theme, prefs.accent, prefs.density, prefs.backgroundEffects, prefs.visuals])

  // Pause every looping animation while the app is in the background (saves battery on phones).
  useEffect(() => {
    const sync = () => { document.documentElement.dataset.hidden = String(document.hidden) }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

  const feedback = (kind: 'check' | 'click' = 'check') => {
    if (prefs.haptics && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(kind === 'check' ? 12 : 6) } catch { /* unsupported */ }
    }
    if (prefs.sound && typeof window !== 'undefined') {
      try {
        const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Ctx) return
        const ctx = new Ctx()
        const osc = ctx.createOscillator(), gain = ctx.createGain()
        osc.type = 'sine'; osc.frequency.value = kind === 'check' ? 660 : 480
        gain.gain.setValueAtTime(0.0001, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09)
        osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.1)
        osc.addEventListener('ended', () => void ctx.close())
      } catch { /* audio unavailable */ }
    }
  }

  const toggleSidebar = () =>
    setCollapsed(c => {
      try { localStorage.setItem(SIDEBAR_KEY, c ? '0' : '1') } catch { /* storage blocked */ }
      return !c
    })

  const toggle = (id: string) =>
    setState(s => {
      const key = dayKey(new Date())
      const was = !!s.completions[key]?.[id]
      feedback(was ? 'click' : 'check')
      return {
        ...s,
        xp: Math.max(0, s.xp + (was ? -XP_PER_TASK : XP_PER_TASK)),
        completions: { ...s.completions, [key]: { ...s.completions[key], [id]: !was } },
      }
    })

  const add = ({ oneOff, ...fields }: HabitFields) =>
    setState(s => ({
      ...s,
      tasks: [...s.tasks, { id: crypto.randomUUID(), createdAt: startOfDay(new Date()), deletedAt: oneOff ? new Date().setHours(24, 0, 0, 0) : null, ...fields }],
    }))

  const update = (id: string, fields: HabitFields) =>
    setState(s => ({
      ...s,
      tasks: s.tasks.map(t => (t.id === id ? { ...t, ...fields } : t)),
    }))

  const remove = (id: string) =>
    setState(s => ({
      ...s,
      tasks: s.tasks.map(t => (t.id === id ? { ...t, deletedAt: startOfDay(new Date()) } : t)),
    }))

  const setName = (name: string) => setState(s => ({ ...s, name }))

  // Goals. A count goal linked to a habit keeps no progress of its own: Evolution counts the habit's check-ins since `createdAt`.
  // An ambition keeps its steps, notes and supporting habits on the goal itself.
  const addGoal = (f: GoalFields) =>
    setState(s => ({ ...s, goals: [...s.goals, { id: crypto.randomUUID(), createdAt: startOfDay(new Date()), notes: [], ...f }] }))
  const updateGoal = (id: string, f: Partial<Goal>) =>
    setState(s => ({
      ...s,
      goals: s.goals.map(g => {
        if (g.id !== id) return g
        // Pointing a count goal at a different habit starts the count from today.
        const relinked = g.kind === 'count' && 'habitId' in f && f.habitId !== g.habitId
        return { ...g, ...f, createdAt: relinked ? startOfDay(new Date()) : g.createdAt }
      }),
    }))
  const updateSpaces = useCallback((spaces: AppState['spaces']) => setState(s => ({ ...s, spaces })), [])

  const removeGoal = (id: string) => setState(s => ({ ...s, goals: s.goals.filter(g => g.id !== id) }))

  const shell = useMemo(() => ({ state, events: cal.events, prefs, updatePrefs, go: setTab, toggle, add }), [state, cal.events, prefs, updatePrefs])

  return (
    <ShellContext.Provider value={shell}>
      <LiquidGlass />
      {/* One app-wide backdrop for every page: ambient light, a built-in live scene, or the custom wallpaper (set in Profile). */}
      <Backdrop
        key={scene.live ? 'app-live' : 'app'}
        className="ambient"
        media={appMedia}
        scene={scene.live ? scene.theme : null}
        blur={scene.blur}
        dim={scene.shade}
      />

      <ReminderToasts events={cal.events} state={state} />
      <Pet />
      <CommandPalette />
      <QuickActions state={state} tab={tab} onAdd={add} onToggle={toggle} onNavigate={setTab} />
      <Sidebar tab={tab} onChange={setTab} collapsed={collapsed} onToggle={toggleSidebar} />
      <main className={`sb-main ${collapsed ? 'lg:pl-[5.5rem]' : 'lg:pl-60'}`}>
        <div key={shownTab} data-pending={tab !== shownTab || undefined} className="page-in mx-auto max-w-6xl px-5 pb-28 pt-6 lg:pb-12">
          <PageBoundary resetKey={shownTab}>
          <Suspense fallback={<PageSkeleton />}>
          {shownTab === 'Home' && (
            <Home
              state={state}
              wall={wall}
              scene={scene}
              onSetScene={setScene}
              onSetWallFile={setFile}
              onClearWall={clear}
              onToggle={toggle}
              onAdd={add}
              onRemove={remove}
              onSetName={setName}
              onNavigate={setTab}
            />
          )}
          {shownTab === 'Habits' && <Habits state={state} onAdd={add} onUpdate={update} onRemove={remove} onToggle={toggle} />}
          {shownTab === 'Analytics' && <Analytics state={state} onNavigate={setTab} />}
          {shownTab === 'Evolution' && (
            <Evolution state={state} onNavigate={setTab} onAddGoal={addGoal} onUpdateGoal={updateGoal} onRemoveGoal={removeGoal} />
          )}
          {shownTab === 'Calendar' && <Calendar state={state} events={cal} onToggle={toggle} />}
          {shownTab === 'Spaces' && <Spaces spaces={state.spaces} onChange={updateSpaces} />}
          {shownTab === 'Profile' && (
            <Profile
              name={state.name}
              state={state}
              prefs={prefs}
              onPrefs={updatePrefs}
              onResetPrefs={resetPrefs}
              onSetName={setName}
              onResetApp={() => setState(loadState())}
              appMedia={{ wall, setFile, clear }}
              scene={scene}
              onScene={setScene}
            />
          )}
          {!['Home', 'Habits', 'Analytics', 'Calendar', 'Spaces', 'Evolution', 'Profile'].includes(shownTab) && (
            <>
              <TopBar name={state.name}>
                <h1 className="text-3xl font-bold tracking-tight">{shownTab}</h1>
              </TopBar>
              <p className="rounded-2xl border border-line bg-panel p-8 text-muted">
                {shownTab} view is coming in a later step.
              </p>
            </>
          )}
          </Suspense>
          </PageBoundary>
        </div>
      </main>
    </ShellContext.Provider>
  )
}
