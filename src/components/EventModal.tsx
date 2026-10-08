import { useState, type FormEvent } from 'react'
import { EVENT_CATS, MAX_YEAR, MIN_YEAR, REMINDERS, REPEATS, toMin, type CalEvent, type EventCat, type EventFields, type Repeat } from '../lib/calendarEvents'
import { loadPreferences } from '../lib/preferences'
import DatePicker from './DatePicker'
import Modal from './Modal'
import TimePicker from './TimePicker'

const field = 'w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm placeholder:text-muted/60 focus:border-teal/50 [color-scheme:dark]'
const label = 'mb-1.5 block text-xs text-muted'
const minDate = `${MIN_YEAR}-01-01`, maxDate = `${MAX_YEAR}-12-31`
const plusHour = (t: string) => { const m = toMin(t); if (m === null) return '10:00'; const n = Math.min(m + 60, 23 * 60 + 59); return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}` }

interface Props {
  initial?: CalEvent
  /** Day for a new event, YYYY-MM-DD. */
  date: string
  /** Start time for a new event, HH:MM. */
  time?: string
  onSave: (f: EventFields) => void
  /** 'one' removes only the opened occurrence of a repeating event. */
  onDelete?: (scope: 'one' | 'all') => void
  onClose: () => void
}

export default function EventModal({ initial, date, time, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [day, setDay] = useState(initial?.date ?? date)
  const [allDay, setAllDay] = useState(initial?.allDay ?? false)
  const [start, setStart] = useState(initial?.time || time || '09:00')
  const [end, setEnd] = useState(initial?.endTime ?? '')
  const [catId, setCatId] = useState<EventCat>(initial?.catId ?? 'personal')
  const [reminder, setReminder] = useState<number | null>(initial ? initial.reminder : null)
  const [repeat, setRepeat] = useState<Repeat>(initial?.repeat ?? 'none')
  const [until, setUntil] = useState(initial?.until ?? '')
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)

  const prefs = loadPreferences()
  const weekStart = prefs.startOfWeek === 'sunday' ? 0 : 1

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) return setError('Give the event a title.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < minDate || day > maxDate) return setError(`Pick a date between ${MIN_YEAR} and ${MAX_YEAR}.`)
    if (!allDay && toMin(start) === null) return setError('Pick a start time.')
    if (!allDay && end && (toMin(end) ?? 0) <= (toMin(start) ?? 0)) return setError('The end time must be after the start time.')
    if (repeat !== 'none' && until && until < day) return setError('The repeat end date is before the first event.')
    onSave({
      title: t.slice(0, 80), notes: notes.trim().slice(0, 500), date: day, allDay, time: allDay ? '' : start, endTime: allDay ? '' : end,
      catId, reminder, repeat, until: repeat === 'none' ? '' : until,
    })
  }

  return (
    <Modal label={initial ? 'Edit event' : 'New event'} onClose={onClose}>
      <h2 className="mb-4 text-lg font-semibold">{initial ? 'Edit event' : 'New event'}</h2>
      <form onSubmit={submit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <div>
          <label htmlFor="ev-title" className={label}>Title</label>
          <input id="ev-title" autoFocus value={title} onChange={e => { setTitle(e.target.value); setError('') }} maxLength={80} placeholder="e.g. Team catch-up" className={field} />
        </div>
        <div>
          <label htmlFor="ev-notes" className={label}>Description (optional)</label>
          <textarea id="ev-notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} rows={2} className={`${field} resize-none`} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="ev-date" className={label}>Date</label>
            <DatePicker variant="field" id="ev-date" label="Date" value={day} onChange={d => { setDay(d); setError('') }} min={minDate} max={maxDate} weekStart={weekStart} format={prefs.dateFormat} clearable={false} />
          </div>
          <div className="col-span-2 flex items-end sm:col-span-1">
            <button type="button" role="switch" aria-checked={allDay} onClick={() => setAllDay(a => !a)} className="flex w-full items-center justify-between rounded-lg border border-line bg-bg px-3 py-2 text-sm">
              All-day
              <span className={`relative h-5 w-9 rounded-full transition-colors ${allDay ? 'bg-teal' : 'bg-white/15'}`}>
                <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${allDay ? 'left-[1.1rem]' : 'left-0.5'}`} />
              </span>
            </button>
          </div>
          {!allDay && (
            <>
              <div>
                <label htmlFor="ev-start" className={label}>Starts</label>
                <TimePicker id="ev-start" label="Starts" value={start} onChange={v => { setStart(v); setError('') }} />
              </div>
              <div>
                <label htmlFor="ev-end" className={label}>Ends (optional)</label>
                <TimePicker id="ev-end" label="Ends" optional placeholder="Not set" fallback={plusHour(start)} value={end} onChange={v => { setEnd(v); setError('') }} />
              </div>
            </>
          )}
        </div>

        <div>
          <span className={label}>Category</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category">
            {EVENT_CATS.map(c => (
              <button key={c.id} type="button" aria-pressed={catId === c.id} onClick={() => setCatId(c.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${catId === c.id ? 'border-white/30 bg-white/10 text-ink' : 'border-white/10 text-ink/65 hover:text-ink'}`}>
                <i aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: c.color }} />{c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="ev-rem" className={label}>Reminder</label>
            <select id="ev-rem" value={reminder === null ? '' : String(reminder)} onChange={e => setReminder(e.target.value === '' ? null : Number(e.target.value))} className={field}>
              {REMINDERS.map(r => <option key={r.label} value={r.value === null ? '' : r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="ev-rep" className={label}>Repeat</label>
            <select id="ev-rep" value={repeat} onChange={e => setRepeat(e.target.value as Repeat)} className={field}>
              {REPEATS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          {repeat !== 'none' && (
            <div className="col-span-2">
              <label htmlFor="ev-until" className={label}>Repeat until (optional)</label>
              <DatePicker variant="field" id="ev-until" label="Repeat until" value={until} onChange={setUntil} min={day || minDate} max={maxDate} weekStart={weekStart} format={prefs.dateFormat} />
            </div>
          )}
        </div>
        {initial && initial.repeat !== 'none' && <p className="text-xs text-muted">This event repeats. Saving changes the whole series.</p>}
        {reminder !== null && <p className="text-xs text-muted">Reminders appear while EVOLVE is open. Allow notifications when asked to get them as system alerts too.</p>}
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

        {confirming ? (
          <div className="space-y-2 border-t border-white/10 pt-4">
            <p className="text-sm">{repeat !== 'none' ? 'Delete which events?' : 'Delete this event?'}</p>
            <div className="flex flex-wrap gap-2">
              {repeat !== 'none' && <button type="button" onClick={() => onDelete?.('one')} className="rounded-lg border border-white/10 px-3.5 py-2 text-sm hover:border-red-400/40 hover:text-red-300">Only this one</button>}
              <button type="button" onClick={() => onDelete?.('all')} className="rounded-lg bg-red-500/80 px-3.5 py-2 text-sm font-medium text-white hover:bg-red-500">{repeat !== 'none' ? 'All events' : 'Delete'}</button>
              <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-white/10 px-3.5 py-2 text-sm text-ink/70 hover:text-ink">Keep</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 border-t border-white/10 pt-4">
            {initial && onDelete && <button type="button" onClick={() => setConfirming(true)} className="rounded-lg px-3.5 py-2 text-sm text-red-300/90 hover:bg-red-500/10">Delete</button>}
            <button type="button" onClick={onClose} className="ml-auto rounded-lg border border-white/10 px-3.5 py-2 text-sm text-ink/70 hover:text-ink">Cancel</button>
            <button className="rounded-lg bg-teal px-4 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90">Save</button>
          </div>
        )}
      </form>
    </Modal>
  )
}
