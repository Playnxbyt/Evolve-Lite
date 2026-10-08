import { useState, type FormEvent } from 'react'
import Modal from './Modal'

const MAX = 500

/** Quick-capture popup, opened from the quick ball. Saved notes show up on the homepage. */
export default function NoteModal({ onSave, onClose }: { onSave: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState('')
  const ready = text.trim().length > 0

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!ready) return
    onSave(text.trim().slice(0, MAX))
    onClose()
  }

  return (
    <Modal label="Quick note" onClose={onClose}>
      <h2 className="mb-4 text-lg font-semibold">Quick note</h2>
      <form onSubmit={submit}>
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
          maxLength={MAX}
          rows={4}
          placeholder="Jot something down…"
          aria-label="Note"
          className="w-full resize-none rounded-lg border border-line bg-bg px-3 py-2.5 text-sm placeholder:text-muted/60 focus:border-teal/50"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs tabular-nums text-muted">{text.length}/{MAX}</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-white/10 px-3.5 py-2 text-sm transition-colors hover:border-teal/40 hover:text-teal">Cancel</button>
            <button disabled={!ready}
              className="rounded-lg bg-teal px-4 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-40">Save note</button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
