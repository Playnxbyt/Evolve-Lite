import { createContext, useContext } from 'react'
import type { AppState, HabitFields } from './core'
import type { CalEvent } from './calendarEvents'
import type { AppPreferences } from './preferences'
import type { Tab } from '../components/Sidebar'

/** App-wide data the header menus (bell and profile) need, so every page's TopBar works without extra props. */
export interface ShellValue {
  state: AppState
  events: CalEvent[]
  prefs: AppPreferences
  updatePrefs: (patch: Partial<AppPreferences>) => void
  go: (tab: Tab) => void
  toggle: (id: string) => void
  add: (fields: HabitFields) => void
}
export const ShellContext = createContext<ShellValue | null>(null)
export const useShell = () => useContext(ShellContext)
