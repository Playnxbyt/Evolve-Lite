import { useState, type FormEvent } from 'react'
import { GOAL_TERMS, catById, type Goal, type GoalFields, type GoalKind, type GoalTerm, type Milestone, type Task } from '../lib/core'
import { MAX_YEAR } from '../lib/calendarEvents'
import { loadPreferences } from '../lib/preferences'
import DatePicker from './DatePicker'
import Modal from './Modal'
import { Icon } from './Icons'

export type { GoalFields }

const field = 'w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm placeholder:text-muted/60 focus:border-teal/50'

const KINDS: { id: GoalKind; label: string; hint: string }[] = [
  { id: 'ambition', label: 'An ambition', hint: 'No number on it. Steps, habits and notes.' },
  { id: 'count', label: 'A number to reach', hint: '12 books, 60 workouts, 100 hours.' },
]

/** One-tap starting points for a number goal, so a new goal is never a blank page. */
const IDEAS: Record<GoalTerm, { t: string; n: number; u: string }[]> = {
  short: [{ t: 'Work out 12 times', n: 12, u: 'workouts' }, { t: 'Read 5 chapters', n: 5, u: 'chapters' }, { t: 'Meditate 10 times', n: 10, u: 'sessions' }],
  mid: [{ t: 'Read 6 books', n: 6, u: 'books' }, { t: 'Complete 60 workouts', n: 60, u: 'workouts' }, { t: 'Study 100 hours', n: 100, u: 'hours' }],
  long: [{ t: 'Run a marathon', n: 42, u: 'km' }, { t: 'Read 52 books', n: 52, u: 'books' }, { t: 'Show up 365 days', n: 365, u: 'days' }],
}

const newId = () => globalThis.crypto?.randomUUID?.() ?? `m${Date.now()}${Math.random().toString(36).slice(2, 7)}`
const toInput = (ms?: number) => {
  if (!ms) return ''
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fromInput = (v: string) => {
  const [y, m, d] = v.split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d).getTime() : undefined
}

interface Props {
  initial?: Goal
  /** Horizon preselected for a new goal. */
  initialTerm?: GoalTerm
  /** An ultimate goal already exists, so a new one cannot be added. */
  hasUltimate?: boolean
  /** Habits a goal can follow. */
  habits: Task[]
  onSubmit: (fields: GoalFields) => void
  onDelete?: () => void
  onClose: () => void
}

export default function GoalModal({ initial, initialTerm, hasUltimate, habits, onSubmit, onDelete, onClose }: Props) {
  const [kind, setKind] = useState<GoalKind>(initial?.kind ?? 'ambition')
  const [term, setTerm] = useState<GoalTerm>(initial?.term ?? initialTerm ?? 'short')
  const [title, setTitle] = useState(initial?.title ?? '')

  // number goal
  const [habitId, setHabitId] = useState(initial?.habitId ?? '')
  const [target, setTarget] = useState(initial && initial.kind === 'count' ? String(initial.target) : '')
  const [unit, setUnit] = useState(initial?.unit ?? '')
  const [current, setCurrent] = useState(initial && initial.kind === 'count' && !initial.habitId ? String(initial.current) : '0')
  const linked = !!habitId
  const prefs = loadPreferences()
  const weekStart = prefs.startOfWeek === 'sunday' ? 0 : 1
  const todayIso = toInput(Date.now())

  // ambition
  const [why, setWhy] = useState(initial?.why ?? '')
  const [deadline, setDeadline] = useState(toInput(initial?.deadline))
  const [steps, setSteps] = useState<Milestone[]>(initial?.milestones ?? [])
  const [feeders, setFeeders] = useState<string[]>(initial?.habitIds ?? [])

  const setStep = (id: string, text: string) => setSteps(xs => xs.map(x => (x.id === id ? { ...x, text } : x)))
  const addStep = () => setSteps(xs => (xs.length >= 20 || (xs.length && !xs[xs.length - 1].text.trim()) ? xs : [...xs, { id: newId(), text: '', doneAt: null }]))
  const toggleFeeder = (id: string) => setFeeders(xs => (xs.includes(id) ? xs.filter(x => x !== id) : [...xs, id]))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const name = title.trim()
    if (!name) return
    if (kind === 'ambition') {
      onSubmit({
        kind, term, title: name.slice(0, 60), target: 1, current: 0,
        why: why.trim().slice(0, 400) || undefined,
        deadline: fromInput(deadline),
        milestones: steps.map(s => ({ ...s, text: s.text.trim().slice(0, 80) })).filter(s => s.text),
        habitIds: feeders.filter(id => habits.some(h => h.id === id)),
      })
      onClose()
      return
    }
    const goal = Math.round(Number(target))
    if (!Number.isFinite(goal) || goal < 1) return
    onSubmit({
      kind, term, milestones: [], habitIds: [],
      title: name.slice(0, 60),
      target: Math.min(goal, 1_000_000),
      habitId: habitId || undefined,
      unit: linked ? 'check-ins' : unit.trim().slice(0, 16) || undefined,
      current: linked ? 0 : Math.max(0, Number(current) || 0),
    })
    onClose()
  }

  const label = initial ? 'Edit goal' : 'New goal'
  return (
    <Modal label={label} onClose={onClose}>
      <h2 className="mb-5 text-lg font-semibold">{label}</h2>
      <form onSubmit={submit} className="-mr-2 max-h-[75vh] space-y-4 overflow-y-auto pr-2">
        <div>
          <span className="mb-1.5 block text-xs text-muted">What kind of goal is it?</span>
          <div role="radiogroup" aria-label="Kind of goal" className="grid grid-cols-2 gap-2">
            {KINDS.map(o => (
              <button key={o.id} type="button" role="radio" aria-checked={kind === o.id} onClick={() => setKind(o.id)}
                className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${kind === o.id ? 'border-teal/60 bg-teal/10' : 'border-line text-ink/70 hover:border-white/25'}`}>
                <span className="block text-sm font-medium">{o.label}</span>
                <span className="block text-[11px] text-muted">{o.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-xs text-muted">Time horizon</span>
          <div role="radiogroup" aria-label="Time horizon" className="grid grid-cols-3 gap-2">
            {GOAL_TERMS.map(o => {
              const taken = o.id === 'long' && !!hasUltimate && initial?.term !== 'long'
              return (
              <button key={o.id} type="button" role="radio" aria-checked={term === o.id} disabled={taken} onClick={() => setTerm(o.id)}
                className={`rounded-lg border px-2.5 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${term === o.id ? 'border-teal/60 bg-teal/10' : 'border-line text-ink/70 hover:border-white/25'}`}>
                <span className="block text-sm font-medium">{o.label}</span>
                <span className="block text-[11px] text-muted">{taken ? 'Already set' : o.hint}</span>
              </button>
            )})}
          </div>
          {term === 'long' && <p className="mt-1.5 text-xs text-muted/80">Your ultimate goal gets its own spotlight card on the Evolution page.</p>}
        </div>

        <div>
          <label htmlFor="goal-title" className="mb-1.5 block text-xs text-muted">{kind === 'ambition' ? 'Your ambition' : 'Goal'}</label>
          <input id="goal-title" autoFocus value={title} onChange={e => setTitle(e.target.value)} maxLength={60}
            placeholder={kind === 'ambition' ? 'Unlock your best version' : 'e.g. Read 12 books'} className={field} />
          {!initial && !title && kind === 'count' && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {IDEAS[term].map(i => (
                <button key={i.t} type="button" onClick={() => { setTitle(i.t); setTarget(String(i.n)); setUnit(i.u); setHabitId('') }}
                  className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-ink/65 transition-colors hover:border-teal/40 hover:text-teal">{i.t}</button>
              ))}
            </div>
          )}
        </div>

        {kind === 'ambition' ? (
          <>
            <div>
              <label htmlFor="goal-why" className="mb-1.5 block text-xs text-muted">Why does it matter? <span className="text-muted/60">(optional)</span></label>
              <textarea id="goal-why" value={why} onChange={e => setWhy(e.target.value)} maxLength={400} rows={2} placeholder="The reason you will come back to on hard days" className={`${field} resize-none`} />
            </div>

            <div>
              <label htmlFor="goal-deadline" className="mb-1.5 block text-xs text-muted">Target date <span className="text-muted/60">(optional)</span></label>
              <DatePicker variant="field" id="goal-deadline" label="Target date" value={deadline} onChange={setDeadline} min={deadline && deadline < todayIso ? deadline : todayIso} max={`${MAX_YEAR}-12-31`} weekStart={weekStart} format={prefs.dateFormat} />
            </div>

            <div>
              <span className="mb-1.5 block text-xs text-muted">Steps on the way <span className="text-muted/60">(optional)</span></span>
              <ul className="space-y-1.5">
                {steps.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-1.5">
                    <input value={s.text} onChange={e => setStep(s.id, e.target.value)} maxLength={80} aria-label={`Step ${i + 1}`} placeholder={`Step ${i + 1}`} className={field}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addStep() } }} />
                    <button type="button" onClick={() => setSteps(xs => xs.filter(x => x.id !== s.id))} aria-label={`Remove step ${i + 1}`}
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-ink/50 transition-colors hover:bg-white/10 hover:text-red-400"><Icon name="close" className="size-4" /></button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={addStep} className="mt-2 inline-flex items-center gap-1 text-xs text-teal/90 transition-colors hover:text-teal"><Icon name="plus" className="size-3.5" />Add a step</button>
              <p className="mt-1.5 text-xs text-muted/80">With steps, progress is how many you have finished. Without them the goal simply stays open until you mark it reached.</p>
            </div>

            <div>
              <span className="mb-1.5 block text-xs text-muted">Habits that feed this goal <span className="text-muted/60">(optional)</span></span>
              {habits.length === 0 ? (
                <p className="text-xs text-muted/80">Add a habit first, like “Study Korean 30 min”, and link it here to see how much daily work goes into this goal.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {habits.map(h => {
                    const on = feeders.includes(h.id)
                    return (
                      <button key={h.id} type="button" role="checkbox" aria-checked={on} onClick={() => toggleFeeder(h.id)}
                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${on ? 'border-teal/60 bg-teal/10 text-teal' : 'border-white/10 text-ink/65 hover:border-white/25'}`}>
                        {h.text} <span className="text-ink/40">· {catById(h.catId).label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div>
              <label htmlFor="goal-habit" className="mb-1.5 block text-xs text-muted">Progress comes from</label>
              <select id="goal-habit" value={habitId} onChange={e => setHabitId(e.target.value)} className={field}>
                <option value="">Numbers I enter myself</option>
                {habits.map(h => <option key={h.id} value={h.id}>Check-ins of {h.text} ({catById(h.catId).label})</option>)}
                {initial?.habitId && !habits.some(h => h.id === initial.habitId) && <option value={initial.habitId}>A habit that was deleted</option>}
              </select>
              <p className="mt-1.5 text-xs text-muted/80">
                {linked ? 'Counts every check-in of this habit from the day the goal is created. Nothing to update by hand.' : 'You update the number yourself, for things EVOLVE cannot see, like books read or kilometres run.'}
              </p>
            </div>

            <div className={`grid gap-3 ${linked ? 'grid-cols-1' : 'grid-cols-3'}`}>
              <div>
                <label htmlFor="goal-target" className="mb-1.5 block text-xs text-muted">{linked ? 'Target check-ins' : 'Target'}</label>
                <input id="goal-target" type="number" min="1" max="1000000" value={target} onChange={e => setTarget(e.target.value)} placeholder={linked ? '60' : '12'} className={field} />
              </div>
              {!linked && (
                <>
                  <div>
                    <label htmlFor="goal-current" className="mb-1.5 block text-xs text-muted">So far</label>
                    <input id="goal-current" type="number" min="0" value={current} onChange={e => setCurrent(e.target.value)} className={field} />
                  </div>
                  <div>
                    <label htmlFor="goal-unit" className="mb-1.5 block text-xs text-muted">Unit</label>
                    <input id="goal-unit" value={unit} onChange={e => setUnit(e.target.value)} maxLength={16} placeholder="books" className={field} />
                  </div>
                </>
              )}
            </div>
          </>
        )}

        <div className="flex items-center justify-between pt-1">
          {onDelete ? (
            <button type="button" onClick={() => { if (confirm('Delete this goal? Your check-ins are not affected.')) { onDelete(); onClose() } }}
              className="rounded-lg px-1 py-2 text-sm text-ink/60 transition-colors hover:text-red-400">Delete</button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3.5 py-2 text-sm transition-colors hover:border-white/25">Cancel</button>
            <button type="submit" className="rounded-lg bg-teal px-3.5 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90">{initial ? 'Save' : 'Add goal'}</button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
