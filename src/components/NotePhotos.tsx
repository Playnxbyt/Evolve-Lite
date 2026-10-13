import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Icon } from './Icons'
import { MAX_PHOTOS, savePhoto, usePhotoUrl } from '../lib/photos'

function Thumb({ id, label, onClick, children }: { id: string; label: string; onClick?: () => void; children?: React.ReactNode }) {
  const url = usePhotoUrl(id)
  return (
    <div className="ph-thumb relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-white/[0.05]">
      {url
        ? <img src={url} alt="" draggable={false} className="size-full object-cover" />
        : <span className="absolute inset-0 animate-pulse bg-white/[0.04]" />}
      {onClick && <button type="button" aria-label={label} onClick={onClick} className="absolute inset-0 transition-colors hover:bg-white/10 active:bg-white/15" />}
      {children}
    </div>
  )
}

/** Full-screen viewer: swipe, arrow keys or the arrows to move between photos, Escape or a tap outside to close. */
function Viewer({ ids, start, onClose }: { ids: string[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start)
  const [dir, setDir] = useState<'cal-next' | 'cal-prev'>('cal-next')
  const url = usePhotoUrl(ids[i])
  const from = useRef<number | null>(null)
  const go = (n: number) => { if (n < 0 || n >= ids.length) return; setDir(n > i ? 'cal-next' : 'cal-prev'); setI(n) }
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go(i - 1)
      if (e.key === 'ArrowRight') go(i + 1)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })
  const down = (e: PointerEvent) => { from.current = e.clientX }
  const up = (e: PointerEvent) => {
    if (from.current === null) return
    const dx = e.clientX - from.current
    from.current = null
    if (Math.abs(dx) > 50) go(dx < 0 ? i + 1 : i - 1)
  }
  const arrow = 'absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur transition hover:bg-black/60 active:scale-90 disabled:pointer-events-none disabled:opacity-0'
  return (
    <div className="ph-viewer fixed inset-0 z-[95] grid place-items-center bg-black/80 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={onClose}>
      <button type="button" aria-label="Close photo" onClick={onClose} className="absolute right-4 top-4 z-10 grid size-11 place-items-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur transition hover:bg-black/60 active:scale-90"><Icon name="close" /></button>
      <button type="button" aria-label="Previous photo" disabled={i === 0} onClick={e => { e.stopPropagation(); go(i - 1) }} className={`${arrow} left-3`}><Icon name="chevron" className="size-5 rotate-180" /></button>
      <button type="button" aria-label="Next photo" disabled={i === ids.length - 1} onClick={e => { e.stopPropagation(); go(i + 1) }} className={`${arrow} right-3`}><Icon name="chevron" className="size-5" /></button>
      <div key={i} className={`${dir} flex max-h-[86vh] max-w-[92vw] touch-pan-y items-center justify-center`} onPointerDown={down} onPointerUp={up} onClick={e => e.stopPropagation()}>
        {url ? <img src={url} alt={`Photo ${i + 1} of ${ids.length}`} draggable={false} className="max-h-[86vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl" /> : <span className="size-40 animate-pulse rounded-2xl bg-white/10" />}
      </div>
      {ids.length > 1 && <p className="absolute bottom-5 rounded-full bg-black/50 px-3 py-1 text-xs tabular-nums text-white/80">{i + 1} / {ids.length}</p>}
    </div>
  )
}

/** The photos on a saved note. Tap one to see it large. */
export function NotePhotoGrid({ ids }: { ids: string[] }) {
  const [view, setView] = useState<number | null>(null)
  if (!ids.length) return null
  const shown = ids.slice(0, 4), extra = ids.length - shown.length
  return (
    <>
      <div className="mt-2.5 grid max-w-sm grid-cols-4 gap-1.5">
        {shown.map((id, n) => (
          <Thumb key={id} id={id} label={`Open photo ${n + 1}`} onClick={() => setView(n)}>
            {extra > 0 && n === shown.length - 1 && <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/55 text-sm font-semibold text-white">+{extra}</span>}
          </Thumb>
        ))}
      </div>
      {view !== null && <Viewer ids={ids} start={view} onClose={() => setView(null)} />}
    </>
  )
}

/** Photo section of the note editor: add from the gallery or take one with the camera, remove with the small x. */
export function PhotoPicker({ ids, onAdd, onRemove }: { ids: string[]; onAdd: (id: string) => void; onRemove: (id: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<number | null>(null)
  const room = MAX_PHOTOS - ids.length

  const pick = async (files: FileList | null) => {
    if (!files || !files.length) return
    setError(''); setBusy(true)
    const list = Array.from(files)
    try {
      for (const f of list.slice(0, room)) onAdd(await savePhoto(f))
      if (list.length > room) setError(`Only ${MAX_PHOTOS} photos fit on one note.`)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'That photo could not be added.')
    } finally { setBusy(false) }
  }
  const btn = 'inline-flex items-center gap-2 rounded-xl border border-line bg-white/[.03] px-3 py-2 text-xs font-medium text-ink/80 transition hover:border-teal/40 hover:text-teal active:scale-95 disabled:pointer-events-none disabled:opacity-40'
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted">Photos <span className="opacity-50">optional</span></span>
        <span className="text-[11px] tabular-nums text-muted">{ids.length}/{MAX_PHOTOS}</span>
      </div>
      {ids.length > 0 && (
        <div className="mb-3 grid grid-cols-4 gap-2">
          {ids.map((id, n) => (
            <Thumb key={id} id={id} label={`View photo ${n + 1}`} onClick={() => setView(n)}>
              <button type="button" aria-label={`Remove photo ${n + 1}`} onClick={() => onRemove(id)}
                className="absolute right-1 top-1 z-10 grid size-6 place-items-center rounded-full bg-black/65 text-white transition hover:bg-red-500/80 active:scale-90"><Icon name="close" className="size-3.5" /></button>
            </Thumb>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <label className={`${btn} cursor-pointer ${room <= 0 || busy ? 'pointer-events-none opacity-40' : ''}`}>
          <Icon name="plus" className="size-4" />{busy ? 'Saving…' : 'Add photo'}
          <input type="file" accept="image/*" multiple className="sr-only" disabled={room <= 0 || busy} onChange={e => { void pick(e.target.files); e.target.value = '' }} />
        </label>
        <label className={`${btn} cursor-pointer ${room <= 0 || busy ? 'pointer-events-none opacity-40' : ''}`}>
          <Icon name="note" className="size-4" />Take photo
          <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={room <= 0 || busy} onChange={e => { void pick(e.target.files); e.target.value = '' }} />
        </label>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
      {view !== null && <Viewer ids={ids} start={view} onClose={() => setView(null)} />}
    </div>
  )
}
