import { RANGES, type RangeId } from '../lib/analyticsStats'

/** The 7 / 30 / 90 / All selector. One highlight glides between the options instead of each pill toggling on its own. */
export default function RangeTabs({ value, onChange }: { value: RangeId; onChange: (id: RangeId) => void }) {
  const index = RANGES.findIndex(r => r.id === value)
  return (
    <div role="group" aria-label="Time range" className="relative grid grid-cols-4 rounded-full border border-white/10 bg-white/[0.04] p-1 text-sm">
      <span aria-hidden="true" className="an-thumb absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-full border border-teal/30 bg-teal/15 shadow-[0_0_18px_rgba(61,220,151,0.18)]"
        style={{ transform: `translateX(${index * 100}%)` }} />
      {RANGES.map(r => (
        <button key={r.id} type="button" aria-pressed={value === r.id} onClick={() => onChange(r.id)}
          className={`relative z-10 min-w-[4.75rem] rounded-full px-3 py-1.5 transition-[color,transform] duration-300 active:scale-95 ${value === r.id ? 'text-ink' : 'text-ink/60 hover:text-ink'}`}>
          {r.label}
        </button>
      ))}
    </div>
  )
}
