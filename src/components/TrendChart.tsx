import { useId, useState, type PointerEvent } from 'react'
import { pct, type Bucket } from '../lib/analyticsStats'

const TARGET = 80
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

interface Pt { x: number; y: number; i: number; v: number }

/**
 * Flowing path through the points: a Catmull-Rom spline converted to cubic Béziers, so the line bends
 * gently through every point with no corners. Control points are kept inside 0 to 100%.
 */
function curve(p: Pt[]) {
  let d = `M${p[0].x.toFixed(2)} ${p[0].y.toFixed(2)}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = clamp(p1.y + (p2.y - p0.y) / 6, 0, 100)
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = clamp(p2.y - (p3.y - p1.y) / 6, 0, 100)
    d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d
}

/** How many neighbours on each side are blended into a point. Denser data is smoothed more, so a long history reads as a trend rather than noise. */
const radiusFor = (n: number) => (n > 45 ? 3 : n > 20 ? 2 : n >= 5 ? 1 : 0)

/**
 * Completion over time. The plot is a stretched SVG (no text inside it, so nothing gets squashed);
 * dots, labels and the tooltip are plain HTML placed with percentages.
 */
export default function TrendChart({ buckets: all, kindLabel, replay }: { buckets: Bucket[]; kindLabel: string; /** Changes whenever the animation should play again. */ replay: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [active, setActive] = useState<number | null>(null)
  // Leave out the stretch before anything was scheduled, so the line uses the whole width.
  const lead = all.findIndex(b => b.possible > 0)
  const buckets = lead > 0 ? all.slice(lead) : all
  const n = buckets.length
  const x = (i: number) => ((i + 0.5) / n) * 100

  const tracked = buckets.flatMap((b, i) => (b.possible > 0 ? [{ i, v: pct(b) }] : []))
  const reach = radiusFor(tracked.length)
  const pts: Pt[] = tracked.map((t, j) => {
    // triangular weights: the point itself counts most, neighbours count less the further away they are
    const near = tracked.slice(Math.max(0, j - reach), j + reach + 1).map((q, k, all) => ({ v: q.v, w: reach + 1 - Math.abs(Math.max(0, j - reach) + k - j) }))
    const v = near.reduce((s, q) => s + q.v * q.w, 0) / near.reduce((s, q) => s + q.w, 0)
    return { x: x(t.i), y: 100 - v, i: t.i, v }
  })
  const segments: Pt[][] = []
  for (const p of pts) {
    const last = segments[segments.length - 1]
    if (last && last[last.length - 1].i === p.i - 1) last.push(p)
    else segments.push([p])
  }
  const showAll = pts.length <= 14
  const act = active !== null ? pts.find(p => p.i === active) : undefined

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' && e.type === 'pointermove') return
    if (!pts.length) return
    const r = e.currentTarget.getBoundingClientRect()
    const at = ((e.clientX - r.left) / r.width) * 100
    setActive(pts.reduce((best, p) => (Math.abs(p.x - at) < Math.abs(best.x - at) ? p : best)).i)
  }

  if (pts.length < 2) {
    return <p className="py-10 text-center text-sm text-ink/60">Check in on a couple of days and your trend will appear here.</p>
  }
  const mid = buckets[Math.floor((n - 1) / 2)]

  return (
    <div>
      <div className="flex gap-3">
        <div aria-hidden="true" className="relative h-52 w-8 shrink-0 text-right text-[10px] tabular-nums text-ink/45">
          {[100, 50, 0].map(v => <span key={v} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - v}%` }}>{v}%</span>)}
        </div>
        <div aria-hidden="true" className="relative h-52 min-w-0 flex-1 touch-pan-y" onPointerMove={move} onPointerLeave={() => setActive(null)} onPointerDown={move}>
          {[0, 50, 100].map(v => <i key={v} className={`absolute inset-x-0 border-t ${v === 50 ? 'border-dashed border-white/10' : 'border-white/10'}`} style={{ top: `${100 - v}%` }} />)}
          <i className="absolute inset-x-0 border-t border-dashed border-teal/35" style={{ top: `${100 - TARGET}%` }} />
          <span className="absolute right-0 text-[10px] text-teal/70" style={{ top: `${100 - TARGET}%`, transform: 'translateY(-110%)' }}>{TARGET}% target</span>

          {/* keyed by the data so the reveal replays when the range changes */}
          <svg key={`${replay}-${n}-${buckets[0].start.getTime()}`} viewBox="0 0 100 100" preserveAspectRatio="none" className="an-reveal absolute inset-0 size-full overflow-visible">
            <defs>
              <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3ddc97" stopOpacity="0.32" /><stop offset="1" stopColor="#3b8cff" stopOpacity="0" /></linearGradient>
              <linearGradient id={`line-${uid}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#3b8cff" /><stop offset="1" stopColor="#3ddc97" /></linearGradient>
            </defs>
            {segments.filter(s => s.length > 1).map((s, k) => (
              <path key={`a${k}`} d={`${curve(s)} L${s[s.length - 1].x} 100 L${s[0].x} 100Z`} fill={`url(#area-${uid})`} stroke="none" className="an-fade" style={{ animationDelay: '0.35s' }} />
            ))}
            {segments.filter(s => s.length > 1).map((s, k) => (
              <path key={`l${k}`} d={curve(s)} fill="none" stroke={`url(#line-${uid})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            ))}
          </svg>

          {pts.map(p => {
            const b = buckets[p.i]
            const on = act?.i === p.i
            if (!showAll && !on && p.i !== pts[pts.length - 1].i) return null
            return (
              <i key={`${replay}-${p.i}`} className={`an-pop absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-200 ${on ? 'scale-125' : ''} ${b.partial ? 'border-2 border-teal bg-bg' : 'bg-teal shadow-[0_0_0_3px_rgba(6,12,18,0.7)]'}`}
                style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${(0.15 + p.x * 0.009).toFixed(2)}s` }} />
            )
          })}

          {act && (
            <>
              <i className="absolute inset-y-0 w-px bg-white/20" style={{ left: `${act.x}%` }} />
              <div className="glass pointer-events-none absolute z-10 w-max max-w-44 rounded-xl px-3 py-2 text-xs" style={{ left: `clamp(4.5rem, ${act.x}%, calc(100% - 4.5rem))`, top: `${clamp(act.y, 14, 70)}%`, transform: 'translate(-50%, -135%)' }}>
                <p className="text-ink/60">{buckets[act.i].label}</p>
                <p className="mt-0.5 text-base font-medium tabular-nums">{pct(buckets[act.i])}%<span className="ml-1.5 text-xs font-normal text-ink/60">completed</span></p>
                <p className="tabular-nums text-ink/60">{buckets[act.i].done} of {buckets[act.i].possible} done{buckets[act.i].partial ? ' so far' : ''}</p>
              </div>
            </>
          )}
        </div>
      </div>
      <div aria-hidden="true" className="ml-11 mt-2 flex justify-between text-[10px] text-ink/45">
        <span>{buckets[0].short}</span>{n > 4 && <span>{mid.short}</span>}<span>{buckets[n - 1].short}</span>
      </div>
      <p className="ml-11 mt-1 text-[11px] text-ink/45">{kindLabel}{reach > 0 ? ', drawn as a smoothed trend; hover for the exact figure' : ''}. A hollow dot is a period still in progress.</p>
      <ul className="sr-only">
        {buckets.filter(b => b.possible > 0).map((b, i) => <li key={i}>{b.label}: {pct(b)}%, {b.done} of {b.possible} check-ins</li>)}
      </ul>
    </div>
  )
}
