import { useState, type FormEvent } from 'react'
import { ALL_DAYS, CATS, type CatId, type HabitFields, type Priority, type Task, type WeekDay } from '../lib/core'
import { Icon } from './Icons'
import Modal from './Modal'
import TimePicker from './TimePicker'

const field = 'w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm placeholder:text-muted/60 focus:border-teal/50'

const DAY_CHIPS: { d: WeekDay; label: string }[] = [
  { d: 1, label: 'M' }, { d: 2, label: 'T' }, { d: 3, label: 'W' }, { d: 4, label: 'T' },
  { d: 5, label: 'F' }, { d: 6, label: 'S' }, { d: 0, label: 'S' },
]

interface Props {
  initial?: Task
  oneOff?: boolean
  onSubmit: (fields: HabitFields) => void
  onClose: () => void
}

export default function HabitModal({ initial, oneOff, onSubmit, onClose }: Props) {
  const noun = oneOff ? 'task' : 'habit'
  const [time, setTime] = useState(initial?.time ?? '')
  const [text, setText] = useState(initial?.text ?? '')
  const [catId, setCatId] = useState<CatId>(initial?.catId ?? 'health')
  const [duration, setDuration] = useState(initial?.duration ? String(initial.duration) : '')
  const [days, setDays] = useState<WeekDay[]>(initial?.days ?? ALL_DAYS)
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'medium')

  const toggleDay = (d: WeekDay) =>
    setDays(cur => (cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d].sort() as WeekDay[]))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    const mins = parseInt(duration, 10)
    onSubmit({
      text: trimmed.slice(0, 80),
      catId,
      priority,
      time: time || undefined,
      oneOff: oneOff || undefined,
      duration: Number.isFinite(mins) && mins > 0 ? mins : undefined,
      days: days.length === 7 ? undefined : days,
    })
    onClose()
  }

  return (
    <Modal label={initial ? `Edit ${noun}` : `Add ${noun}`} onClose={onClose}>
      <h2 className="mb-5 text-lg font-semibold">{initial ? `Edit ${noun}` : `New ${noun}`}</h2>
      <form onSubmit={submit} className="space-y-4">
        <input
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          maxLength={80}
          placeholder="e.g. Morning Workout"
          aria-label="Habit name"
          className={field}
        />

        <div>
          <span className="mb-1.5 block text-xs text-muted">Category</span>
          <div className="grid grid-cols-5 gap-1.5">
            {CATS.map(c => (
              <button
                type="button"
                key={c.id}
                onClick={() => setCatId(c.id)}
                aria-pressed={catId === c.id}
                className={`flex flex-col items-center gap-1.5 rounded-lg border py-2.5 transition-colors ${
                  catId === c.id
                    ? 'border-teal/50 bg-teal/[0.08] text-ink'
                    : 'border-white/10 text-muted hover:border-white/25 hover:text-ink'
                }`}
              >
                <Icon name={c.icon} className="size-4" style={{ color: c.color }} />
                <span className="text-[9.5px] leading-none">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="habit-duration" className="mb-1.5 block text-xs text-muted">
              Duration (mins, optional)
            </label>
            <input
              id="habit-duration"
              type="number"
              min="0"
              max="600"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="30"
              className={field}
            />
          </div>
          <div>
            <label htmlFor="habit-priority" className="mb-1.5 block text-xs text-muted">
              Priority
            </label>
            <select
              id="habit-priority"
              value={priority}
              onChange={e => setPriority(e.target.value as Priority)}
              className={field}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="habit-time" className="mb-1.5 block text-xs text-muted">Time (optional)</label>
          <TimePicker id="habit-time" label="Time" optional placeholder="Anytime" value={time} onChange={setTime} />
        </div>

        <div className={oneOff ? 'hidden' : ''}>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs text-muted">Repeat</span>
            <button
              type="button"
              onClick={() => setDays(ALL_DAYS)}
              className={`text-[11px] hover:text-teal ${days.length === 7 ? 'text-teal' : 'text-muted/70'}`}
            >
              Daily
            </button>
          </div>
          <div className="flex gap-1.5">
            {DAY_CHIPS.map(({ d, label }) => {
              const on = days.includes(d)
              return (
                <button
                  type="button"
                  key={d}
                  onClick={() => toggleDay(d)}
                  aria-pressed={on}
                  className={`grid size-9 flex-1 place-items-center rounded-lg border text-xs transition-colors ${
                    on ? 'border-teal/50 bg-teal/10 text-teal' : 'border-white/10 text-muted hover:border-white/25'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-muted hover:text-ink">
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-teal px-5 py-2 text-sm font-medium text-bg transition-colors hover:bg-teal/85"
          >
            {initial ? 'Save changes' : 'Add habit'}
          </button>
        </div>
      </form>
    </Modal>
  )
}