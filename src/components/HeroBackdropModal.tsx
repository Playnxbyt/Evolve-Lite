import { useRef, useState } from 'react'
import { DEFAULT_HERO_BG, HERO_LIMITS, auraColors, type HeroBg } from '../lib/evolutionHero'
import { Icon } from './Icons'
import { THEMES } from './LiveScene'
import Modal from './Modal'

interface Props {
  bg: HeroBg
  stage: number
  custom: 'image' | 'video' | null
  onChange: (patch: Partial<HeroBg>) => void
  onFile: (f: File) => Promise<string | null>
  onClear: () => void
  onClose: () => void
}

export default function HeroBackdropModal({ bg, stage, custom, onChange, onFile, onClear, onClose }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [a, b] = auraColors(stage)
  const pick = async (f?: File) => {
    if (!f) return
    setBusy(true); setError(null)
    const err = await onFile(f)
    setBusy(false)
    if (err) setError(err)
  }
  const choose = (mode: string) => { onChange({ mode }); if (custom) onClear() }
  const options = [
    { id: 'aura', label: 'Level aura', css: `radial-gradient(circle at 75% 40%, ${a}99, transparent 60%), radial-gradient(circle at 15% 90%, ${b}77, transparent 55%), #050c13` },
    ...THEMES.map(t => ({ id: t.id as string, label: t.label, css: `linear-gradient(180deg, ${t.v['--sky1']}, ${t.v['--sky2']} 55%, ${t.v['--sky3']})` })),
  ]
  const pill = 'rounded-lg border border-white/10 px-2.5 py-1 text-xs transition-colors hover:border-teal/40 hover:text-teal'

  return (
    <Modal label="Hero background" onClose={onClose}>
      <h2 className="text-lg font-semibold">Hero background</h2>
      <p className="mt-1 text-sm text-muted">Choose a look for the top card, or use your own image, GIF or video.</p>

      <div className="mt-5 grid grid-cols-4 gap-2.5">
        {options.map(o => {
          const active = !custom && bg.mode === o.id
          return (
            <button key={o.id} type="button" onClick={() => choose(o.id)} aria-pressed={active}
              className={`group rounded-xl p-1.5 text-center transition-all ${active ? 'bg-teal/15 ring-1 ring-teal/60' : 'hover:bg-white/[0.05]'}`}>
              <span className="block h-14 rounded-lg" style={{ background: o.css }} />
              <span className={`mt-1.5 block text-[11px] ${active ? 'text-teal' : 'text-muted group-hover:text-ink'}`}>{o.label}</span>
            </button>
          )
        })}
      </div>

      <button type="button" onClick={() => input.current?.click()} disabled={busy}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 py-4 text-sm text-muted transition-colors hover:border-teal/50 hover:text-teal disabled:opacity-60">
        <Icon name="image" className="size-4" />
        {busy ? 'Saving…' : custom ? `Replace custom ${custom}` : 'Upload image, GIF or video'}
      </button>
      <input ref={input} type="file" accept="image/*,video/*" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} />
      <p className="mt-2 text-xs text-muted/80">Videos play muted on a loop (max 40 MB). Everything stays in this browser.</p>
      {error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}
      {custom && <button type="button" onClick={onClear} className="mt-2 rounded-lg px-2 py-2 text-sm text-muted hover:text-red-400">Remove custom background</button>}

      <label className="mt-4 block text-sm">
        <span className="flex justify-between text-muted"><span>Darken for readability</span><span className="tabular-nums">{Math.round(bg.dim * 100)}%</span></span>
        <input type="range" min={0} max={HERO_LIMITS.dim * 100} value={Math.round(bg.dim * 100)} onChange={e => onChange({ dim: Number(e.target.value) / 100 })} className="mt-2 h-6 w-full cursor-pointer accent-teal" aria-label="Darken the hero background" />
      </label>
      {custom === 'image' && (
        <label className="mt-1 block text-sm">
          <span className="flex justify-between text-muted"><span>Blur</span><span className="tabular-nums">{bg.blur === 0 ? 'Off' : `${bg.blur} px`}</span></span>
          <input type="range" min={0} max={HERO_LIMITS.blur} value={bg.blur} onChange={e => onChange({ blur: Number(e.target.value) })} className="mt-2 h-6 w-full cursor-pointer accent-teal" aria-label="Blur the hero background" />
        </label>
      )}

      <div className="mt-5 flex items-center justify-between">
        <button type="button" onClick={() => { onChange(DEFAULT_HERO_BG); if (custom) onClear() }} className={pill}>Reset to default</button>
        <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3.5 py-2 text-sm transition-colors hover:border-teal/40 hover:text-teal">Done</button>
      </div>
    </Modal>
  )
}
