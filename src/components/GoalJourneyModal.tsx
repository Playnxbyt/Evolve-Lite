import { useState, type FormEvent } from 'react'
import { GOAL_TERMS, catById, type Goal } from '../lib/core'
import type { GoalView } from '../lib/evolution'
import { Icon } from './Icons'
import Modal from './Modal'

const eyebrow = 'text-[11px] font-medium uppercase tracking-[0.18em] text-ink/55'
const plural = (n: number, w: string) => `${n.toLocaleString('en-US')} ${w}${n === 1 ? '' : 's'}`
const newId = () => globalThis.crypto?.randomUUID?.() ?? `n${Date.now()}${Math.random().toString(36).slice(2, 7)}`

interface Props {
  g: GoalView
  now: Date
  fmt: (d: Date) => string
  onUpdate: (f: Partial<Goal>) => void
  onEdit: () => void
  onClose: () => void
}

/**
 * The home of an ambition: what it is for, the steps on the way, the habits that feed it and a journal.
 * There is nothing to "log a number" for, so the daily action is a note (a win, a lesson, a setback) and the
 * habit check-ins that already happen elsewhere in the app.
 */
export default function GoalJourneyModal({ g, now, fmt, onUpdate, onEdit, onClose }: Props) {
  const goal = g.goal
  const [note, setNote] = useState('')
  const term = GOAL_TERMS.find(t => t.id === goal.term)

  const toggleStep = (id: string) =>
    onUpdate({ milestones: goal.milestones.map(m => (m.id === id ? { ...m, doneAt: m.doneAt ? null : Date.now() } : m)) })

  const addNote = (e: FormEvent) => {
    e.preventDefault()
    const text = note.trim()
    if (!text) return
    onUpdate({ notes: [{ id: newId(), at: Date.now(), text: text.slice(0, 500) }, ...goal.notes].slice(0, 200) })
    setNote('')
  }

  const notes = [...goal.notes].sort((a, b) => b.at - a.at)
  const todayNote = notes.some(n => new Date(n.at).toDateString() === now.toDateString())

  return (
    <Modal label={`Journey: ${goal.title}`} onClose={onClose}>
      <div className="-mr-2 max-h-[80vh] space-y-5 overflow-y-auto pr-2">
        <header>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={eyebrow}>{term?.label ?? 'Goal'} ambition{g.done ? ' · reached' : ''}</p>
              <h2 className="mt-1.5 break-words text-xl font-semibold leading-snug">{goal.title}</h2>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-lg text-ink/55 transition-colors hover:bg-white/10 hover:text-ink"><Icon name="close" className="size-4" /></button>
          </div>
          {goal.why && <p className="mt-2 text-sm italic leading-relaxed text-ink/60">“{goal.why}”</p>}
          <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div><dt className="text-[11px] text-ink/50">On this goal</dt><dd className="tabular-nums">{plural(g.daysIn, 'day')}</dd></div>
            <div>
              <dt className="text-[11px] text-ink/50">Target date</dt>
              <dd className="tabular-nums">{goal.deadline ? (g.daysLeft !== null && g.daysLeft >= 0 ? `${plural(g.daysLeft, 'day')} left` : 'Passed') : 'Open'}</dd>
              {goal.deadline && <dd className="text-[11px] text-ink/45">{fmt(new Date(goal.deadline))}</dd>}
            </div>
            <div><dt className="text-[11px] text-ink/50">Steps</dt><dd className="tabular-nums">{g.measurable ? `${g.steps.done} of ${g.steps.total}` : 'None set'}</dd></div>
          </dl>
          {g.measurable && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="hb-w h-full rounded-full" style={{ width: `${g.pct}%`, background: 'linear-gradient(90deg,#f0b45a,#64e8d3)' }} />
            </div>
          )}
        </header>

        <section aria-label="Steps">
          <h3 className={eyebrow}>Steps</h3>
          {goal.milestones.length === 0 ? (
            <p className="mt-2 text-sm text-ink/60">No steps yet. Add a few from Edit to break the ambition into things you can finish, or keep it open and log notes below.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {goal.milestones.map(m => (
                <li key={m.id}>
                  <button type="button" role="checkbox" aria-checked={!!m.doneAt} onClick={() => toggleStep(m.id)}
                    className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.05]">
                    <span className={`mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border transition-colors ${m.doneAt ? 'border-transparent bg-gradient-to-br from-mint to-teal text-bg' : 'border-white/30'}`}>
                      {m.doneAt && <Icon name="check" className="size-3" />}
                    </span>
                    <span className={`min-w-0 flex-1 break-words text-sm ${m.doneAt ? 'text-ink/50 line-through' : ''}`}>{m.text}</span>
                    {m.doneAt && <span className="shrink-0 text-[11px] tabular-nums text-ink/40">{fmt(new Date(m.doneAt))}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {g.support.length > 0 && (
          <section aria-label="Habits that feed this goal">
            <h3 className={eyebrow}>The daily work</h3>
            <ul className="mt-2 divide-y divide-white/[0.06]">
              {g.support.map(({ habit, week, total }) => (
                <li key={habit.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{habit.text} <span className="text-[11px] text-ink/40">· {catById(habit.catId).label}</span></span>
                  <span className="shrink-0 text-xs tabular-nums text-ink/55">{week} this week · {total} in all</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] text-ink/45">Counted from the day you set this goal. Check them off on the Habits page as usual.</p>
          </section>
        )}

        <section aria-label="Journal">
          <h3 className={eyebrow}>Journal</h3>
          <form onSubmit={addNote} className="mt-2">
            <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} rows={2} aria-label="New journal note"
              placeholder={todayNote ? 'Anything else worth remembering?' : 'What moved this forward today? A win, something you learned, or a setback.'}
              className="w-full resize-none rounded-lg border border-line bg-bg px-3 py-2 text-sm placeholder:text-muted/60 focus:border-teal/50" />
            <div className="mt-2 flex justify-end">
              <button type="submit" disabled={!note.trim()} className="rounded-lg bg-teal px-3.5 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-40">Log it</button>
            </div>
          </form>
          {notes.length > 0 && (
            <ul className="mt-2 space-y-3">
              {notes.slice(0, 20).map(n => (
                <li key={n.id} className="group flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] tabular-nums text-ink/45">{fmt(new Date(n.at))}</p>
                    <p className="whitespace-pre-wrap break-words text-sm text-ink/85">{n.text}</p>
                  </div>
                  <button type="button" onClick={() => onUpdate({ notes: goal.notes.filter(x => x.id !== n.id) })} aria-label="Delete note"
                    className="grid size-7 shrink-0 place-items-center rounded-md text-ink/35 transition-colors hover:bg-white/10 hover:text-red-400"><Icon name="close" className="size-3.5" /></button>
                </li>
              ))}
              {notes.length > 20 && <li className="text-[11px] text-ink/45">Showing the latest 20 of {notes.length}.</li>}
            </ul>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
          <button type="button" onClick={onEdit} className="rounded-lg border border-white/10 px-3.5 py-2 text-sm transition-colors hover:border-white/25">Edit goal</button>
          {goal.achievedAt ? (
            <button type="button" onClick={() => onUpdate({ achievedAt: undefined })} className="rounded-lg px-3 py-2 text-sm text-ink/60 transition-colors hover:text-ink">Reopen</button>
          ) : !g.done ? (
            <button type="button" onClick={() => { if (confirm('Mark this goal as reached?')) onUpdate({ achievedAt: Date.now() }) }}
              className="rounded-lg bg-gradient-to-r from-[#f0b45a] to-[#64e8d3] px-3.5 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90">Mark as reached</button>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
