import { useEffect, useMemo, useRef, useState } from 'react'
import { useShell } from '../lib/shell'
import { dayKey, tasksOn } from '../lib/core'
import type { Tab } from './Sidebar'

/* Ctrl/Cmd + K (or "/") opens a quick bar: jump to any page, tick tasks off, or add a task for today.
   Outside of typing, the number keys 1 to 6 switch pages. */

const TABS: Tab[] = ['Home', 'Habits', 'Analytics', 'Calendar', 'Evolution', 'Profile']

interface Item { id: string; label: string; hint: string; run: () => void }

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

export default function CommandPalette() {
  const shell = useShell()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setQ(''); setIdx(0); setOpen(o => !o); return }
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return
      if (e.key === '/' && !open) { e.preventDefault(); setQ(''); setIdx(0); setOpen(true); return }
      if (!open && /^[1-6]$/.test(e.key)) shell?.go(TABS[Number(e.key) - 1])
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open, shell])

  useEffect(() => { if (open) input.current?.focus() }, [open])

  const items = useMemo<Item[]>(() => {
    if (!shell) return []
    const t = q.trim().toLowerCase()
    const close = () => setOpen(false)
    const out: Item[] = []
    TABS.forEach((tab, i) => {
      if (!t || tab.toLowerCase().includes(t)) out.push({ id: `go-${tab}`, label: `Go to ${tab}`, hint: String(i + 1), run: () => { shell.go(tab); close() } })
    })
    const now = new Date()
    const done = shell.state.completions[dayKey(now)] ?? {}
    tasksOn(shell.state, now).filter(x => !t || x.text.toLowerCase().includes(t)).slice(0, 6).forEach(x => {
      out.push({ id: `task-${x.id}`, label: x.text, hint: done[x.id] ? 'Done · undo' : 'Mark done', run: () => shell.toggle(x.id) })
    })
    if (t) out.push({ id: 'add', label: `Add “${q.trim()}” to today`, hint: 'New task', run: () => { shell.add({ catId: 'productivity', text: q.trim(), priority: 'medium', oneOff: true }); close() } })
    if (!t || 'pet mochi hide show'.includes(t)) out.push({ id: 'pet', label: 'Hide or show Mochi', hint: 'Pet', run: () => { window.dispatchEvent(new Event('evolve:pet')); close() } })
    return out
  }, [q, shell, open])

  useEffect(() => { setIdx(0) }, [q])
  useEffect(() => { list.current?.children[idx]?.scrollIntoView({ block: 'nearest' }) }, [idx])

  if (!open || !shell) return null

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(items.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); items[idx]?.run() }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-start justify-items-center px-4 pt-[14vh]" role="dialog" aria-modal="true" aria-label="Quick actions">
      <button aria-label="Close" tabIndex={-1} onClick={() => setOpen(false)} className="modal-scrim absolute inset-0 cursor-default bg-black/55" />
      <div className="cmdk-panel glass relative w-full max-w-lg overflow-hidden rounded-3xl" onKeyDown={onKey}>
        <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Jump to a page, tick a task, or type to add one…"
          className="w-full bg-transparent px-5 py-4 text-base outline-none placeholder:text-ink/45" aria-label="Search actions" />
        <ul ref={list} className="max-h-[50vh] overflow-y-auto overscroll-contain border-t border-white/10 p-2">
          {items.map((it, i) => (
            <li key={it.id}>
              <button onMouseMove={() => setIdx(i)} onClick={it.run}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${i === idx ? 'bg-white/12 text-teal' : ''}`}>
                <span className="min-w-0 truncate">{it.label}</span>
                <span className="shrink-0 text-xs text-ink/50">{it.hint}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t border-white/10 px-5 py-2 text-[11px] text-ink/45">↑ ↓ to move · Enter to choose · Esc to close · keys 1–6 switch pages</p>
      </div>
    </div>
  )
}
