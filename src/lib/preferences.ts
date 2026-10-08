import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'midnight' | 'obsidian' | 'soft'
export type Accent = 'teal' | 'blue' | 'violet' | 'amber'
export type Density = 'comfortable' | 'compact'
export type DateFormat = 'regional' | 'iso'

export interface AppPreferences {
  birthDate: string
  bio: string
  avatar: string | null
  notifications: boolean
  systemNotifications: boolean
  habitReminders: boolean
  eventReminders: boolean
  theme: ThemeMode
  accent: Accent
  density: Density
  backgroundEffects: boolean
  minimalEffects: boolean
  sound: boolean
  haptics: boolean
  timeFormat: '12h' | '24h'
  dateFormat: DateFormat
  startOfWeek: 'monday' | 'sunday'
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  birthDate: '',
  bio: '',
  avatar: null,
  notifications: true,
  systemNotifications: false,
  habitReminders: true,
  eventReminders: true,
  theme: 'midnight',
  accent: 'teal',
  density: 'comfortable',
  backgroundEffects: true,
  minimalEffects: false,
  sound: false,
  haptics: true,
  timeFormat: '12h',
  dateFormat: 'regional',
  startOfWeek: 'monday',
}

const KEY = 'evolvePreferences'

export function loadPreferences(): AppPreferences {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<AppPreferences> | null
    if (!p) return DEFAULT_PREFERENCES
    return {
      ...DEFAULT_PREFERENCES,
      ...p,
      birthDate: typeof p.birthDate === 'string' ? p.birthDate : '',
      bio: typeof p.bio === 'string' ? p.bio.slice(0, 240) : '',
      avatar: typeof p.avatar === 'string' ? p.avatar : null,
      minimalEffects: p.minimalEffects === true,
      theme: p.theme === 'obsidian' || p.theme === 'soft' ? p.theme : 'midnight',
      accent: p.accent === 'blue' || p.accent === 'violet' || p.accent === 'amber' ? p.accent : 'teal',
      density: p.density === 'compact' ? 'compact' : 'comfortable',
      timeFormat: p.timeFormat === '24h' ? '24h' : '12h',
      dateFormat: p.dateFormat === 'iso' ? 'iso' : 'regional',
      startOfWeek: p.startOfWeek === 'sunday' ? 'sunday' : 'monday',
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function savePreferences(prefs: AppPreferences) {
  try { localStorage.setItem(KEY, JSON.stringify(prefs)) } catch { /* storage blocked/full */ }
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<AppPreferences>(loadPreferences)
  useEffect(() => { savePreferences(prefs) }, [prefs])
  const update = useCallback((patch: Partial<AppPreferences>) => setPrefs(cur => ({ ...cur, ...patch })), [])
  const reset = useCallback(() => setPrefs(DEFAULT_PREFERENCES), [])
  return { prefs, update, reset }
}

export function weekStartIndex() {
  return loadPreferences().startOfWeek === 'sunday' ? 0 : 1
}

export function orderedWeekdayIndex(date: Date) {
  const start = weekStartIndex()
  return (date.getDay() - start + 7) % 7
}

export function formatTime(date: Date | string, timeFormat = loadPreferences().timeFormat) {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: timeFormat === '12h' })
}

export function calculateAge(birthDate: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null
  const [y, m, d] = birthDate.split('-').map(Number)
  const born = new Date(y, m - 1, d)
  if (born.getFullYear() !== y || born.getMonth() !== m - 1 || born.getDate() !== d || born > now) return null
  let age = now.getFullYear() - y
  const birthdayPassed = now.getMonth() > m - 1 || (now.getMonth() === m - 1 && now.getDate() >= d)
  if (!birthdayPassed) age--
  return age
}
