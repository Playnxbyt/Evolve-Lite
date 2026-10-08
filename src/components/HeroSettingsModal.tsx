import type { ReactNode } from 'react'
import {
  CLOCK_COLORS, CLOCK_SIZES, CLOCK_STYLES, DEFAULT_CLOCK, DEFAULT_RING, DEFAULT_RING_LABEL, RING_LABEL_MAX,
  type ClockPrefs, type RingPrefs,
} from '../lib/heroPrefs'
import DigitalClock from './DigitalClock'
import Modal from './Modal'
import Switch from './Switch'

export type CustomTab = 'clock' | 'ring'

interface Props {
  tab: CustomTab
  onTab: (t: CustomTab) => void
  now: Date
  clock: ClockPrefs
  ring: RingPrefs
  pct: number
  done: number
  total: number
  onClock: (patch: Partial<ClockPrefs>) => void
  onRing: (patch: Partial<RingPrefs>) => void
  onResetClock: () => void
  onResetRing: () => void
  onClose: () => void
}

const btn = 'rounded-lg border border-white/10 px-3.5 py-2 text-sm transition-colors hover:border-teal/40 hover:text-teal disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-inherit'
const eyebrow = 'mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-ink/60'

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-white/[0.06] p-1">
      {options.map(o => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
          className={`rounded-lg py-1.5 text-sm transition-colors ${value === o.id ? 'bg-white/15 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]' : 'text-ink/60 hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {hint && <p className="text-xs text-ink/55">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

export default function HeroSettingsModal({ tab, onTab, now, clock, ring, pct, done, total, onClock, onRing, onResetClock, onResetRing, onClose }: Props) {
  const clockIsDefault = JSON.stringify(clock) === JSON.stringify(DEFAULT_CLOCK)
  const ringIsDefault = ring.label === DEFAULT_RING.label && ring.count === DEFAULT_RING.count
  const tabs: { id: CustomTab; label: string }[] = [{ id: 'clock', label: 'Clock' }, { id: 'ring', label: 'Ring text' }]

  return (
    <Modal label="Customize" onClose={onClose}>
      <h2 className="mb-4 text-lg font-semibold">Customize</h2>

      <div role="tablist" aria-label="Customize" className="mb-4 grid grid-cols-2 rounded-xl bg-white/[0.06] p-1">
        {tabs.map(t => (
          <button key={t.id} type="button" role="tab" id={`cust-tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`cust-panel-${t.id}`} onClick={() => onTab(t.id)}
            className={`rounded-lg py-2 text-sm transition-colors ${tab === t.id ? 'bg-white/15 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]' : 'text-ink/60 hover:text-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'clock' && (
        <div role="tabpanel" id="cust-panel-clock" aria-labelledby="cust-tab-clock">
          <div className="mb-4 grid min-h-24 place-items-center overflow-hidden rounded-2xl bg-black/35 px-3 py-5 ring-1 ring-white/10">
            <DigitalClock now={now} prefs={clock} />
          </div>

          <p className={eyebrow}>Style</p>
          <div className="grid grid-cols-2 gap-2">
            {CLOCK_STYLES.map(s => (
              <button key={s.id} type="button" aria-pressed={clock.style === s.id} onClick={() => onClock({ style: s.id })}
                className={`grid gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors ${clock.style === s.id ? 'border-teal/60 bg-teal/10' : 'border-white/10 hover:border-white/25'}`}>
                <span className="grid h-9 place-items-center overflow-hidden">
                  <DigitalClock now={now} size="xs" prefs={{ ...clock, style: s.id, seconds: false, hour24: true }} />
                </span>
                <span className="text-xs text-ink/70">{s.label}</span>
              </button>
            ))}
          </div>

          <p className={`${eyebrow} mt-4`}>Size</p>
          <Seg label="Clock size" value={clock.size} options={CLOCK_SIZES} onChange={size => onClock({ size })} />

          <p className={`${eyebrow} mt-4`}>Colour</p>
          <div className="flex items-center gap-2.5" role="group" aria-label="Clock colour">
            {CLOCK_COLORS.map(c => (
              <button key={c.id} type="button" aria-label={c.label} aria-pressed={clock.color === c.id} title={c.label} onClick={() => onClock({ color: c.id })}
                style={{ backgroundColor: c.id }}
                className={`size-7 rounded-full transition-transform hover:scale-110 ${clock.color === c.id ? 'ring-2 ring-white ring-offset-2 ring-offset-black/60' : 'ring-1 ring-white/20'}`} />
            ))}
          </div>
          {clock.style === 'classic' && <p className="mt-2 text-xs text-ink/55">Classic keeps white digits. Colour tints the Neon, Flip and LED looks.</p>}

          <div className="mt-3 divide-y divide-white/10 border-t border-white/10">
            <Row label="24-hour time"><Switch checked={clock.hour24} onChange={() => onClock({ hour24: !clock.hour24 })} label="24-hour time" /></Row>
            <Row label="Show seconds"><Switch checked={clock.seconds} onChange={() => onClock({ seconds: !clock.seconds })} label="Show seconds" /></Row>
            <Row label="Show date"><Switch checked={clock.date} onChange={() => onClock({ date: !clock.date })} label="Show date" /></Row>
          </div>

          <div className="mt-4 flex justify-between gap-2">
            <button type="button" onClick={onResetClock} disabled={clockIsDefault} className={btn}>Reset clock</button>
            <button type="button" onClick={onClose} className={btn}>Done</button>
          </div>
        </div>
      )}

      {tab === 'ring' && (
        <div role="tabpanel" id="cust-panel-ring" aria-labelledby="cust-tab-ring">
          <div className="mb-4 grid min-h-32 place-items-center rounded-2xl bg-black/35 px-3 py-5 ring-1 ring-white/10">
            <div className="grid size-28 place-content-center rounded-full bg-white/[0.07] text-center ring-1 ring-white/25">
              <div className="text-3xl font-medium tabular-nums">{pct}<span className="text-base text-ink/80">%</span></div>
              <div className="mx-auto max-w-[6.5rem] break-words text-[11px] leading-tight text-ink/85">{ring.label.trim() || DEFAULT_RING_LABEL}</div>
              {ring.count && <div className="mt-0.5 text-[10px] tabular-nums text-ink/70">{done} / {total} completed</div>}
            </div>
          </div>

          <label htmlFor="ring-label" className={eyebrow}>Label</label>
          <input id="ring-label" value={ring.label} maxLength={RING_LABEL_MAX} placeholder={DEFAULT_RING_LABEL} onChange={e => onRing({ label: e.target.value })}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm placeholder:text-muted/60 focus:border-teal/50" />
          <p className="mt-1 text-right text-xs tabular-nums text-ink/55">{ring.label.length}/{RING_LABEL_MAX}</p>

          <div className="mt-2 border-t border-white/10">
            <Row label="Show completed count" hint="The “2 / 5 completed” line under the label">
              <Switch checked={ring.count} onChange={() => onRing({ count: !ring.count })} label="Show completed count" />
            </Row>
          </div>

          <div className="mt-4 flex justify-between gap-2">
            <button type="button" onClick={onResetRing} disabled={ringIsDefault} className={btn}>Reset to default</button>
            <button type="button" onClick={onClose} className={btn}>Done</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
