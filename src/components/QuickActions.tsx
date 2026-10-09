import { useEffect, useState } from 'react'
import { dayKey, tasksOn, type AppState, type HabitFields } from '../lib/core'
import { Icon, type IconName } from './Icons'
import HabitModal from './HabitModal'
import Modal from './Modal'
import NoteModal from './NoteModal'
import Switch from './Switch'
import type { Tab } from './Sidebar'

/** Events other parts of the app use to reach the quick actions (or to hand work back to the Home page). */
export const QUICK_EVENT = 'evolve:quick'
export const FOCUS_EVENT = 'evolve:start-focus'
export const NOTES_EVENT = 'evolve:notes'
export const NOTES_KEY = 'evolveNotes'
/** Set when "Start Focus" is chosen on another page; Home picks it up once it has mounted. */
export const focusRequest = { pending: false }

type ModalKind = 'habit' | 'task' | 'log' | 'note'
interface Note { id: string; text: string; at: number }

const readNotes = (): Note[] => {
  try { const v: unknown = JSON.parse(localStorage.getItem(NOTES_KEY) ?? '[]'); return Array.isArray(v) ? (v as Note[]) : [] } catch { return [] }
}

interface Props {
  state: AppState
  tab: Tab
  onAdd: (fields: HabitFields) => void
  onToggle: (id: string) => void
  onNavigate: (tab: Tab) => void
}

/**
 * The glowing orb button with its action menu. It lives in App so it is on every page.
 * It sits at the bottom-right. The pet peeks in from the right edge higher up (see Pet.tsx) and
 * tucks itself away while this menu is open, so the two never overlap.
 */
export default function QuickActions({ state, tab, onAdd, onToggle, onNavigate }: Props) {
  const [fab, setFab] = useState(false)
  const [modal, setModal] = useState<ModalKind | null>(null)

  useEffect(() => {
    if (!fab) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFab(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fab])

  // lets the pet step aside while the menu is open
  useEffect(() => {
    document.documentElement.toggleAttribute('data-fab', fab)
    return () => document.documentElement.removeAttribute('data-fab')
  }, [fab])

  // Home asks for the "add habit" form when there is nothing to focus on.
  useEffect(() => {
    const open = (e: Event) => { const k = (e as CustomEvent<ModalKind>).detail; if (k) setModal(k) }
    window.addEventListener(QUICK_EVENT, open)
    return () => window.removeEventListener(QUICK_EVENT, open)
  }, [])

  const startFocus = () => {
    if (tab === 'Home') { window.dispatchEvent(new Event(FOCUS_EVENT)); return }
    focusRequest.pending = true
    onNavigate('Home')
  }
  const addNote = (text: string) => {
    try { localStorage.setItem(NOTES_KEY, JSON.stringify([{ id: crypto.randomUUID(), text, at: Date.now() }, ...readNotes()])) } catch { /* storage full or blocked */ }
    window.dispatchEvent(new Event(NOTES_EVENT))
  }

  const actions: { label: string; icon: IconName; run: () => void }[] = [
    { label: 'Add Task', icon: 'plus', run: () => setModal('task') },
    { label: 'Add Habit', icon: 'habits', run: () => setModal('habit') },
    { label: 'Start Focus', icon: 'play', run: startFocus },
    { label: 'Log', icon: 'check', run: () => setModal('log') },
    { label: 'Quick Note', icon: 'note', run: () => setModal('note') },
  ]

  const now = new Date()
  const todays = tasksOn(state, now)
  const done = state.completions[dayKey(now)] ?? {}
  const close = () => setModal(null)

  return (
    <>
      <div className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-4 z-30 lg:bottom-8 lg:right-8">
        {fab && <button aria-label="Close actions" tabIndex={-1} className="fixed inset-0 -z-10 cursor-default" onClick={() => setFab(false)} />}
        <ul className="pointer-events-none absolute bottom-16 right-0 flex flex-col items-end gap-2">
          {actions.map((a, i) => (
            <li key={a.label} style={{ transitionDelay: fab ? `${(actions.length - 1 - i) * 35}ms` : '0ms' }}
              className={`transition-all duration-200 ${fab ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'}`}>
              <button tabIndex={fab ? 0 : -1} onClick={() => { setFab(false); a.run() }}
                className="glass liquid flex items-center gap-2.5 whitespace-nowrap rounded-full py-2 pl-3 pr-4 text-sm transition-colors hover:text-teal">
                <Icon name={a.icon} className="size-4 text-teal" />{a.label}
              </button>
            </li>
          ))}
        </ul>
        <button aria-label={fab ? 'Close actions' : 'Open actions'} aria-expanded={fab} data-open={fab} onClick={() => setFab(o => !o)} className="orb">
          <span className="orb-glow" aria-hidden="true" />
          <span className="orb-ring" aria-hidden="true" /><span className="orb-ring" aria-hidden="true" />
          <span className="orb-core" aria-hidden="true"><i /><i /><i /><i /></span>
          <svg viewBox="0 0 24 24" className="orb-x" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg>
        </button>
      </div>

      {(modal === 'habit' || modal === 'task') && <HabitModal oneOff={modal === 'task'} onSubmit={onAdd} onClose={close} />}
      {modal === 'log' && (
        <Modal label="Log today" onClose={close}>
          <h2 className="mb-4 text-lg font-semibold">Log today</h2>
          {todays.length === 0 && <p className="text-sm text-muted">Nothing to log yet.</p>}
          <ul className="space-y-1">
            {todays.map(t => (
              <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-white/[0.04]">
                <span className={`min-w-0 truncate text-sm transition-colors duration-300 ${done[t.id] ? 'text-ink/40 line-through' : ''}`}>{t.text}</span>
                <Switch checked={!!done[t.id]} onChange={() => onToggle(t.id)} label={`Mark ${t.text} done`} />
              </li>
            ))}
          </ul>
          <button onClick={close} className="mt-5 w-full rounded-lg border border-white/10 px-3.5 py-2 text-sm transition-colors hover:border-teal/40 hover:text-teal">Done</button>
        </Modal>
      )}
      {modal === 'note' && <NoteModal onSave={addNote} onClose={close} />}
    </>
  )
}
