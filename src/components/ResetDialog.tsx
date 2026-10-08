import { useState, type FormEvent } from 'react'
import Modal from './Modal'

interface Props {
  /** The name the person has to type. Falls back to RESET when no name has been set. */
  name: string
  onConfirm: () => void | Promise<void>
  onClose: () => void
}

const LOSES = ['Habits, check-ins and streaks', 'Goals, XP and your rank', 'Profile details and settings', 'Calendar events and custom wallpapers']

export default function ResetDialog({ name, onConfirm, onClose }: Props) {
  const phrase = name.trim() || 'RESET'
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const match = typed.trim().toLowerCase() === phrase.toLowerCase()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!match || busy) return
    setBusy(true)
    await onConfirm()
  }

  return (
    <Modal label="Reset all EVOLVE data" onClose={busy ? () => {} : onClose}>
      <form onSubmit={submit} className="rd">
        <h2 className="text-lg font-semibold">Reset all EVOLVE data?</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink/60">This permanently deletes everything stored in this browser. It cannot be undone.</p>
        <ul className="rd-list">{LOSES.map(l => <li key={l}>{l}</li>)}</ul>

        <label className="mt-5 block text-sm text-ink/70" htmlFor="reset-confirm">
          {name.trim() ? <>Type your name, <b className="rd-phrase">{phrase}</b>, to confirm</> : <>Type <b className="rd-phrase">{phrase}</b> to confirm</>}
        </label>
        <div className="rd-input" data-match={match}>
          <input id="reset-confirm" autoFocus autoComplete="off" autoCorrect="off" spellCheck={false} value={typed} onChange={e => setTyped(e.target.value)} placeholder={phrase} disabled={busy} />
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="profile-quiet-btn px-3 py-2 text-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="rd-danger" disabled={!match || busy}>{busy ? 'Deleting…' : 'Delete everything'}</button>
        </div>
      </form>
    </Modal>
  )
}
