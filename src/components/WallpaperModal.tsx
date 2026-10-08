import { useRef, useState } from 'react'
import { THEMES } from './LiveScene'
import { SOFT_WALL, WALL_LIMITS, type SceneSettings } from '../lib/wallpaper'
import { Icon } from './Icons'
import Modal from './Modal'

interface Props {
  theme: string
  dim: number
  blur: number
  shade: number
  custom: 'image' | 'video' | null
  onTheme: (id: string) => void
  onDim: (v: number) => void
  onBlur: (v: number) => void
  onShade: (v: number) => void
  onPreset: (patch: Partial<SceneSettings>) => void
  onFile: (f: File) => Promise<string | null>
  onClear: () => void
  onClose: () => void
}

export default function WallpaperModal({ theme, dim, blur, shade, custom, onTheme, onDim, onBlur, onShade, onPreset, onFile, onClear, onClose }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async (f?: File) => {
    if (!f) return
    setBusy(true); setError(null)
    const err = await onFile(f)
    setBusy(false)
    if (err) setError(err)
  }

  return (
    <Modal label="Wallpaper" onClose={onClose}>
      <h2 className="text-lg font-semibold">Wallpaper</h2>
      <p className="mt-1 text-sm text-muted">Pick a live scene or use your own image, GIF or video.</p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {THEMES.map(t => {
          const active = !custom && theme === t.id
          return (
            <button key={t.id} onClick={() => onTheme(t.id)} aria-pressed={active}
              className={`group rounded-xl p-1.5 text-center transition-all ${active ? 'bg-teal/15 ring-1 ring-teal/60' : 'hover:bg-white/[0.05]'}`}>
              <span className="block h-16 rounded-lg" style={{ background: `linear-gradient(180deg, ${t.v['--sky1']}, ${t.v['--sky2']} 55%, ${t.v['--sky3']})` }} />
              <span className={`mt-1.5 block text-xs ${active ? 'text-teal' : 'text-muted group-hover:text-ink'}`}>{t.label}</span>
            </button>
          )
        })}
      </div>

      <button onClick={() => input.current?.click()} disabled={busy}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 py-4 text-sm text-muted transition-colors hover:border-teal/50 hover:text-teal disabled:opacity-60">
        <Icon name="image" className="size-4" />
        {busy ? 'Saving…' : custom ? `Replace custom ${custom}` : 'Upload image, GIF or video'}
      </button>
      <input ref={input} type="file" accept="image/*,video/*" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} />
      <p className="mt-2 text-xs text-muted/80">Videos play muted on a loop (max 40 MB). Everything stays in this browser.</p>
      {error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}
      {custom && (
        <button onClick={onClear} className="mt-3 rounded-lg px-2 py-2 text-sm text-muted hover:text-red-400">Remove custom wallpaper</button>
      )}

      {custom && (
        <div className="mt-5 rounded-xl bg-white/[0.04] p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-sm">Behind the cards</p>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => onPreset({ blur: 0, shade: 0 })}
                className="rounded-lg border border-white/10 px-2.5 py-1 text-xs transition-colors hover:border-teal/40 hover:text-teal">Fully clear</button>
              <button type="button" onClick={() => onPreset({ blur: SOFT_WALL.blur, shade: 0.475 })}
                className="rounded-lg border border-white/10 px-2.5 py-1 text-xs transition-colors hover:border-teal/40 hover:text-teal">Soft</button>
            </div>
          </div>
          <label className="mt-3 block text-sm">
            <span className="flex justify-between text-muted"><span>Blur</span><span className="tabular-nums">{blur === 0 ? 'Off' : `${blur} px`}</span></span>
            <input type="range" min={0} max={WALL_LIMITS.blur} value={blur} onChange={e => onBlur(Number(e.target.value))} className="mt-2 h-6 w-full cursor-pointer accent-teal" aria-label="Blur of the wallpaper behind the cards" />
          </label>
          <label className="mt-2 block text-sm">
            <span className="flex justify-between text-muted"><span>Darken</span><span className="tabular-nums">{Math.round(shade * 100)}%</span></span>
            <input type="range" min={0} max={Math.round(WALL_LIMITS.shade * 100)} value={Math.round(shade * 100)} onChange={e => onShade(Number(e.target.value) / 100)} className="mt-2 h-6 w-full cursor-pointer accent-teal" aria-label="Darkness of the wallpaper behind the cards" />
          </label>
          <p className="mt-1 text-xs text-muted/80">Applies behind Home and Habits.</p>
        </div>
      )}

      <label className="mt-5 block text-sm">
        <span className="flex justify-between text-muted"><span>Hero text readability</span><span className="tabular-nums">{Math.round(dim * 100)}%</span></span>
        <input type="range" min={0} max={70} value={Math.round(dim * 100)} onChange={e => onDim(Number(e.target.value) / 100)}
          className="mt-2 h-6 w-full cursor-pointer accent-teal" aria-label="Darken wallpaper behind text" />
      </label>

      <button onClick={onClose} className="mt-5 w-full rounded-lg border border-white/10 px-3.5 py-2 text-sm transition-colors hover:border-teal/40 hover:text-teal">Done</button>
    </Modal>
  )
}
