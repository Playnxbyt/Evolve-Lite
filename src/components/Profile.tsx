import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { streak, type AppState } from '../lib/core'
import { badgeSrc, stageInfo } from '../lib/evolution'
import { DEFAULT_WALL, DEFAULT_WALLPAPER, SOFT_WALL, WALL_LIMITS, type SceneSettings, type Wallpaper } from '../lib/wallpaper'
import { calculateAge, type AppPreferences, type Accent, type Density, type ThemeMode } from '../lib/preferences'
import { Icon } from './Icons'
import LiveScene, { THEMES } from './LiveScene'
import DatePicker from './DatePicker'
import ResetDialog from './ResetDialog'

interface MediaSlot {
  wall: Wallpaper | null
  setFile: (f: File) => Promise<string | null>
  clear: () => void | Promise<void>
}

interface Props {
  name: string
  state: AppState
  prefs: AppPreferences
  onPrefs: (patch: Partial<AppPreferences>) => void
  onResetPrefs: () => void
  onSetName: (name: string) => void
  onResetApp: () => void
  appMedia: MediaSlot
  scene: SceneSettings
  onScene: (patch: Partial<SceneSettings>) => void
}

const eyebrow = 'text-[11px] font-medium uppercase tracking-[0.18em]'
const section = 'profile-section border-b border-white/[0.08] py-9 first:pt-0 last:border-b-0'

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange} className="profile-toggle" data-on={checked}>
      <span />
    </button>
  )
}

function SettingRow({ icon, title, description, children }: { icon: Parameters<typeof Icon>[0]['name']; title: string; description?: string; children: ReactNode }) {
  return (
    <div className="profile-setting-row">
      <div className="flex min-w-0 items-start gap-4">
        <span className="profile-setting-icon"><Icon name={icon} className="size-[17px]" /></span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          {description && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink/50">{description}</p>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Select({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { id: string; label: string }[]; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={e => onChange(e.target.value)} className="profile-select">
      {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  )
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="profile-segmented">
      {options.map(o => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)} className={value === o.id ? 'is-active' : ''}>{o.label}</button>
      ))}
    </div>
  )
}

function Upload({ slot, accept, noun, note }: { slot: MediaSlot; accept: string; noun: string; note: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pick = async (f?: File) => {
    if (!f) return
    setBusy(true); setError(null)
    const err = await slot.setFile(f)
    setBusy(false)
    if (err) setError(err)
  }
  return (
    <div>
      <button type="button" onClick={() => input.current?.click()} disabled={busy} className="profile-outline-btn">
        <Icon name="image" className="size-4" /> {busy ? 'Saving…' : slot.wall ? `Replace ${noun}` : `Upload ${noun}`}
      </button>
      <input ref={input} type="file" accept={accept} hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} />
      <p className="mt-2 text-xs text-ink/40">{note}</p>
      {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
      {slot.wall && <button type="button" onClick={() => slot.clear()} className="mt-2 text-xs text-ink/50 hover:text-red-400">Remove {noun}</button>}
    </div>
  )
}

function ageText(birthDate: string) {
  const age = calculateAge(birthDate)
  return age === null ? '—' : `${age}`
}

export default function Profile({ name, state, prefs, onPrefs, onResetPrefs, onSetName, onResetApp, appMedia, scene, onScene }: Props) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(name)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [exported, setExported] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const avatarInput = useRef<HTMLInputElement>(null)
  const info = stageInfo(state.xp)
  const currentStreak = streak(state)
  const totalCheckIns = Object.values(state.completions).reduce((n, day) => n + Object.values(day).filter(Boolean).length, 0)
  const pct = (v: number) => Math.round(v * 100)
  const initials = (name.trim()[0] ?? 'E').toUpperCase()
  // Which app wallpaper is showing: a live scene wins, then "Evolve Wallpaper" (none), then the user's own upload, else the bundled default.
  const bgNow: 'live' | 'evolve' | 'custom' | 'default' = scene.live ? 'live' : scene.bg === 'evolve' ? 'evolve' : scene.bg === 'custom' && appMedia.wall ? 'custom' : 'default'
  const hasPicture = bgNow === 'custom' || bgNow === 'default'

  const saveName = () => {
    onSetName(draftName.trim().slice(0, 40))
    setEditing(false)
  }

  const uploadAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !f.type.startsWith('image/')) return
    setAvatarBusy(true)
    try {
      const url = URL.createObjectURL(f)
      const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url })
      const scale = Math.min(1, 640 / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale))
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      const data = canvas.toDataURL('image/jpeg', 0.86)
      onPrefs({ avatar: data })
    } catch { /* invalid image */ }
    setAvatarBusy(false)
  }

  const exportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      appState: state,
      preferences: prefs,
      scene,
      calendarEvents: (() => { try { return JSON.parse(localStorage.getItem('evolveCalendarEvents') ?? '[]') } catch { return [] } })(),
      // Every saved EVOLVE setting (looks, notes, focus, clock...) so an import restores the app exactly.
      storage: (() => {
        const out: Record<string, string> = {}
        try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('evolve') && k !== 'evolveCalendarFired') out[k] = localStorage.getItem(k) ?? '' } } catch { /* storage blocked */ }
        return out
      })(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `evolve-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url)
    setExported(true); window.setTimeout(() => setExported(false), 1800)
  }

  const importInput = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState('')
  const importData = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const data = JSON.parse(await file.text()) as Record<string, unknown>
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('bad file')
      // Collect what to write: the full "storage" dump if present, else the older four fields.
      const writes: Record<string, string> = {}
      const raw = data.storage
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (k.startsWith('evolve') && k !== 'evolveCalendarFired' && typeof v === 'string') writes[k] = v
      } else {
        if (data.appState && typeof data.appState === 'object') writes.evolveAppData = JSON.stringify(data.appState)
        if (data.preferences && typeof data.preferences === 'object') writes.evolvePreferences = JSON.stringify(data.preferences)
        if (data.scene && typeof data.scene === 'object') writes.evolveScene = JSON.stringify(data.scene)
        if (Array.isArray(data.calendarEvents)) writes.evolveCalendarEvents = JSON.stringify(data.calendarEvents)
      }
      if (!writes.evolveAppData && !writes.evolvePreferences && !writes.evolveCalendarEvents) throw new Error('not an EVOLVE backup')
      if (!window.confirm('Import this backup? It replaces the habits, goals, events and settings currently in this app.')) return
      for (const [k, v] of Object.entries(writes)) localStorage.setItem(k, v)
      window.location.reload()
    } catch {
      setImportMsg('That file is not a valid EVOLVE backup.')
      window.setTimeout(() => setImportMsg(''), 4000)
    }
  }

  const resetEverything = async () => {
    try {
      await appMedia.clear()
      localStorage.clear()
    } catch { /* continue with reload */ }
    onResetApp()
    window.location.reload()
  }

  const themeOptions: { id: ThemeMode; label: string }[] = [
    { id: 'midnight', label: 'Midnight' }, { id: 'obsidian', label: 'Obsidian' }, { id: 'soft', label: 'Soft dark' },
  ]
  const accentOptions: { id: Accent; label: string }[] = [
    { id: 'teal', label: 'Teal' }, { id: 'blue', label: 'Blue' }, { id: 'violet', label: 'Violet' }, { id: 'amber', label: 'Amber' },
  ]

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div>
          <p className={`${eyebrow} text-ink/45`}>Personal space</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Profile</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/55">Your identity, preferences, and the way EVOLVE fits into your everyday life.</p>
        </div>
        <div className="profile-header-meta">
          <img src={badgeSrc(info.index)} alt="" draggable={false} />
          <div><span>LEVEL {info.level}</span><strong>{info.title}</strong></div>
        </div>
      </header>

      <section className={section} aria-labelledby="identity-title">
        <div className="profile-identity">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar">
              {prefs.avatar ? <img src={prefs.avatar} alt="Profile" /> : <span>{initials}</span>}
            </div>
            <button type="button" className="profile-avatar-edit" aria-label="Change profile image" onClick={() => avatarInput.current?.click()} disabled={avatarBusy}><Icon name="edit" className="size-3.5" /></button>
            <input ref={avatarInput} hidden type="file" accept="image/*" onChange={uploadAvatar} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              {editing ? (
                <div className="flex w-full max-w-xl items-center gap-2">
                  <input autoFocus value={draftName} onChange={e => setDraftName(e.target.value)} maxLength={40} className="profile-name-input" aria-label="Name" />
                  <button type="button" className="profile-primary-btn" onClick={saveName}>Save</button>
                  <button type="button" className="profile-quiet-btn" onClick={() => { setDraftName(name); setEditing(false) }}>Cancel</button>
                </div>
              ) : (
                <>
                  <h2 id="identity-title" className="text-2xl font-semibold tracking-tight">{name || 'Your name'}</h2>
                  <button type="button" className="profile-icon-btn" onClick={() => setEditing(true)} aria-label="Edit name"><Icon name="edit" className="size-4" /></button>
                </>
              )}
            </div>
            <textarea value={prefs.bio} onChange={e => onPrefs({ bio: e.target.value.slice(0, 240) })} rows={2} placeholder="Write a short line about who you're becoming…" className="profile-bio" />
            <div className="profile-stat-line">
              <span><b>{info.level}</b> level</span><i />
              <span><b>{state.xp.toLocaleString()}</b> XP</span><i />
              <span><b>{currentStreak}</b> day streak</span><i />
              <span><b>{totalCheckIns}</b> check-ins</span>
            </div>
          </div>
        </div>

        <div className="profile-details-grid">
          <div>
            <span id="birth-label" className={eyebrow}>Birth date</span>
            <div className="mt-2">
              <DatePicker label="Birth date" value={prefs.birthDate} onChange={birthDate => onPrefs({ birthDate })} weekStart={prefs.startOfWeek === 'sunday' ? 0 : 1} format={prefs.dateFormat} startView="years" showToday={false} />
            </div>
          </div>
          <div>
            <span className={eyebrow}>Current age</span>
            <p className="mt-2 text-2xl font-medium tabular-nums">{ageText(prefs.birthDate)}<span className="ml-2 text-sm font-normal text-ink/45">years</span></p>
          </div>
        </div>
      </section>

      <section className={section} aria-labelledby="progress-title">
        <div className="profile-section-heading"><p className={eyebrow}>EVOLVE status</p><h2 id="progress-title">Where you are now</h2></div>
        <div className="profile-progress-line">
          <div><span className="text-xs text-ink/45">Current rank</span><strong>{info.title}</strong></div>
          <div><span className="text-xs text-ink/45">XP</span><strong>{state.xp.toLocaleString()}</strong></div>
          <div><span className="text-xs text-ink/45">Next level</span><strong>{info.next ? `${info.toNext.toLocaleString()} XP` : 'Complete'}</strong>{info.next && <span className="text-xs text-ink/45">to reach {info.next.title}</span>}</div>
          <div className="profile-progress-bar"><span style={{ width: `${info.pct}%` }} /></div>
        </div>
      </section>

      <section className={section} aria-labelledby="settings-title">
        <div className="profile-section-heading"><p className={eyebrow}>Control center</p><h2 id="settings-title">Settings</h2><p>Everything that changes how EVOLVE behaves lives here.</p></div>

        <div className="profile-settings-group">
          <h3>Notifications</h3>
          <SettingRow icon="bell" title="Notifications" description="Enable EVOLVE reminders and in-app notification behavior."><Toggle checked={prefs.notifications} onChange={() => onPrefs({ notifications: !prefs.notifications })} label="Notifications" /></SettingRow>
          <SettingRow icon="bell" title="Habit reminders" description="Use scheduled habit times to remind you while EVOLVE is open."><Toggle checked={prefs.habitReminders && prefs.notifications} onChange={() => onPrefs({ habitReminders: !prefs.habitReminders })} label="Habit reminders" /></SettingRow>
          <SettingRow icon="calendar" title="Task & calendar reminders" description="Allow reminders attached to calendar events and tasks."><Toggle checked={prefs.eventReminders && prefs.notifications} onChange={() => onPrefs({ eventReminders: !prefs.eventReminders })} label="Calendar reminders" /></SettingRow>
          <SettingRow icon="bell" title="System notifications" description="Show supported reminders as operating-system notifications. Browser permission may be required."><Toggle checked={prefs.systemNotifications && prefs.notifications} onChange={async () => { onPrefs({ systemNotifications: !prefs.systemNotifications }); if (!prefs.systemNotifications && typeof Notification !== 'undefined' && Notification.permission === 'default') { try { await Notification.requestPermission() } catch {} } }} label="System notifications" /></SettingRow>
        </div>

        <div className="profile-settings-group">
          <h3>Appearance</h3>
          <SettingRow icon="goal" title="Theme" description="Change the tonal character of the entire interface."><Select value={prefs.theme} onChange={v => onPrefs({ theme: v as ThemeMode })} options={themeOptions} label="Theme" /></SettingRow>
          <SettingRow icon="goal" title="Accent" description="Use one accent consistently across controls, focus states, and highlights.">
            <div className="profile-accent-options">
              {accentOptions.map(o => (
                <button key={o.id} type="button" aria-label={o.label} aria-pressed={prefs.accent === o.id} onClick={() => onPrefs({ accent: o.id })} className={`profile-accent ${o.id} ${prefs.accent === o.id ? 'is-active' : ''}`} />
              ))}
            </div>
          </SettingRow>
          <SettingRow icon="evolution" title="Interface density" description="Choose how much breathing room the application uses. This affects the whole app."><Segmented value={prefs.density} onChange={v => onPrefs({ density: v as Density })} options={[{ id: 'comfortable', label: 'Comfortable' }, { id: 'compact', label: 'Compact' }]} label="Interface density" /></SettingRow>
          <SettingRow icon="image" title="Background effects" description="Keep EVOLVE's ambient motion and atmospheric background effects on or off."><Toggle checked={prefs.backgroundEffects} onChange={() => onPrefs({ backgroundEffects: !prefs.backgroundEffects })} label="Background effects" /></SettingRow>
          <SettingRow icon="evolution" title="Minimal effects" description="For a smoother feel on phones: removes the live blur behind cards and keeps the background still. Everything else stays the same."><Toggle checked={prefs.minimalEffects} onChange={() => onPrefs({ minimalEffects: !prefs.minimalEffects })} label="Minimal effects" /></SettingRow>
        </div>

        <div className="profile-settings-group">
          <h3>Wallpaper</h3>
          <div className="profile-wallpaper-grid">
            <div>
              <p className="text-sm font-medium">App background</p>
              <p className="mt-1 text-xs leading-relaxed text-ink/45">Your wallpaper, used behind every page of the app. The default is the snowy campfire video; pick Evolve Wallpaper below for no wallpaper.</p>
              <div className="mt-4"><Upload slot={{ ...appMedia, setFile: async f => { const err = await appMedia.setFile(f); if (!err) onScene({ live: false, bg: 'custom' }); return err } }} accept="image/*,video/*" noun="wallpaper" note="Images, GIFs and muted looping video up to 40 MB." /></div>
              {hasPicture && <div className="mt-4 flex gap-2"><button type="button" onClick={() => onScene({ blur: DEFAULT_WALL.blur, shade: DEFAULT_WALL.shade })} className="profile-quiet-btn">Default</button><button type="button" onClick={() => onScene({ blur: 0, shade: 0 })} className="profile-quiet-btn">Clear</button><button type="button" onClick={() => onScene({ blur: SOFT_WALL.blur, shade: 0.475 })} className="profile-quiet-btn">Soft</button></div>}
            </div>
            <div className="space-y-5">
              <label className="block"><span className="text-xs text-ink/45">Wallpaper blur</span><input type="range" min={0} max={WALL_LIMITS.blur} value={scene.blur} onChange={e => onScene({ blur: Number(e.target.value) })} className="profile-range" /></label>
              <label className="block"><span className="flex justify-between text-xs text-ink/45"><span>Wallpaper shade</span><span>{pct(scene.shade)}%</span></span><input type="range" min={0} max={pct(WALL_LIMITS.shade)} value={pct(scene.shade)} onChange={e => onScene({ shade: Number(e.target.value) / 100 })} className="profile-range" /></label>
            </div>
          </div>
          <div className="mt-8 border-t border-white/[0.06] pt-7">
            <p className="text-sm font-medium">Choose a background</p>
            <p className="mt-1 text-xs text-ink/45">Use the default video, Evolve Wallpaper (no wallpaper, just EVOLVE's own glow), your upload, or an animated live scene. The blur and shade sliders above apply to videos, images and live scenes.</p>
            <div className="profile-theme-strip mt-4" role="radiogroup" aria-label="App background scene">
              <button type="button" role="radio" aria-checked={bgNow === 'default'} onClick={() => onScene({ live: false, bg: 'default', blur: DEFAULT_WALL.blur, shade: DEFAULT_WALL.shade })} className={bgNow === 'default' ? 'is-active' : ''}>
                <span><video src={`${DEFAULT_WALLPAPER.url}#t=1`} muted playsInline preload="metadata" className="size-full rounded-[inherit] object-cover" /></span><b>Default</b>
              </button>
              <button type="button" role="radio" aria-checked={bgNow === 'evolve'} onClick={() => onScene({ live: false, bg: 'evolve' })} className={bgNow === 'evolve' ? 'is-active' : ''}>
                <span style={{ background: 'linear-gradient(135deg, #0a141b, #123039 70%, #1b4a46)' }} /><b>Evolve Wallpaper</b>
              </button>
              {appMedia.wall && (
                <button type="button" role="radio" aria-checked={bgNow === 'custom'} onClick={() => onScene({ live: false, bg: 'custom' })} className={bgNow === 'custom' ? 'is-active' : ''}>
                  <span>{appMedia.wall.kind === 'video' ? <video src={appMedia.wall.url} muted playsInline className="size-full rounded-[inherit] object-cover" /> : <img src={appMedia.wall.url} alt="" className="size-full rounded-[inherit] object-cover" />}</span><b>My wallpaper</b>
                </button>
              )}
              {THEMES.map(t => (
                <button key={t.id} type="button" role="radio" aria-checked={scene.live && scene.theme === t.id}
                  onClick={() => onScene(scene.live ? { theme: t.id } : { theme: t.id, live: true, blur: Math.min(scene.blur, 8), shade: Math.min(scene.shade, 0.25) })}
                  className={scene.live && scene.theme === t.id ? 'is-active' : ''}>
                  <span className="relative overflow-hidden"><LiveScene theme={t.id} lite /></span><b>{t.label}</b>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="profile-settings-group">
          <h3>Feedback & interaction</h3>
          <SettingRow icon="check" title="Sound feedback" description="A tiny confirmation tone when you complete or interact with a habit."><Toggle checked={prefs.sound} onChange={() => onPrefs({ sound: !prefs.sound })} label="Sound feedback" /></SettingRow>
          <SettingRow icon="check" title="Haptic feedback" description="Use supported device vibration for completion and small interactions."><Toggle checked={prefs.haptics} onChange={() => onPrefs({ haptics: !prefs.haptics })} label="Haptic feedback" /></SettingRow>
        </div>

        <div className="profile-settings-group">
          <h3>Time & calendar</h3>
          <SettingRow icon="clock" title="Time format" description="Controls time labels used throughout EVOLVE where a choice is available."><Segmented value={prefs.timeFormat} onChange={v => onPrefs({ timeFormat: v as AppPreferences['timeFormat'] })} options={[{ id: '12h', label: '12-hour' }, { id: '24h', label: '24-hour' }]} label="Time format" /></SettingRow>
          <SettingRow icon="calendar" title="Date format" description="Choose a concise regional display or an ISO-style numeric format where supported."><Select value={prefs.dateFormat} onChange={v => onPrefs({ dateFormat: v as AppPreferences['dateFormat'] })} options={[{ id: 'regional', label: 'Regional' }, { id: 'iso', label: 'YYYY-MM-DD' }]} label="Date format" /></SettingRow>
          <SettingRow icon="calendar" title="Start of week" description="Changes week ordering and calendar week calculations across EVOLVE."><Segmented value={prefs.startOfWeek} onChange={v => onPrefs({ startOfWeek: v as AppPreferences['startOfWeek'] })} options={[{ id: 'monday', label: 'Monday' }, { id: 'sunday', label: 'Sunday' }]} label="Start of week" /></SettingRow>
        </div>

        <div className="profile-settings-group">
          <h3>Data</h3>
          <SettingRow icon="goal" title="Export EVOLVE data" description="Download your habits, completions, goals, preferences, calendar events and appearance settings as JSON. Use Import to restore it, on this device or another."><button type="button" className="profile-outline-btn" onClick={exportData}>{exported ? 'Exported' : 'Export data'}</button></SettingRow>
          <SettingRow icon="goal" title="Import EVOLVE data" description={importMsg || 'Restore a backup file you exported earlier. This replaces what is currently in the app, so export first if you want to keep it. Wallpaper videos and images are not included in backups.'}>
            <input ref={importInput} type="file" accept="application/json,.json" className="hidden" onChange={importData} />
            <button type="button" className="profile-outline-btn" onClick={() => importInput.current?.click()}>Import data</button>
          </SettingRow>
          <SettingRow icon="close" title="Reset preferences" description="Return Profile settings to their defaults without deleting your habits or history."><button type="button" className="profile-quiet-btn" onClick={() => { if (window.confirm('Reset all Profile preferences?')) onResetPrefs() }}>Reset settings</button></SettingRow>
          <SettingRow icon="close" title="Reset all EVOLVE data" description="Permanently delete your habits, history, goals, profile, settings, events and custom media."><button type="button" className="profile-danger-btn" onClick={() => setConfirmReset(true)}>Reset everything</button></SettingRow>
        </div>

        <div className="profile-settings-group profile-about">
          <h3>About EVOLVE</h3>
          <div className="profile-about-row"><span>Version</span><b>2.0.0</b></div>
          <div className="profile-about-row"><span>Built for</span><b>Small steps, every day.</b></div>
        </div>
      </section>
      {confirmReset && <ResetDialog name={name} onConfirm={resetEverything} onClose={() => setConfirmReset(false)} />}
    </div>
  )
}
