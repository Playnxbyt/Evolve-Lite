import { useEffect, useId, useRef, useState } from 'react'
import type { RadarAxis } from '../lib/analyticsStats'

const SIZE = 300, C = SIZE / 2, R = 88, LABEL_R = R + 30
/** Side padding so labels at the left and right tips (like "Mindset") are never cut off. */
const PAD = 36
const LEVELS = [25, 50, 75, 100]

const point = (i: number, n: number, r: number): [number, number] => {
  const a = -Math.PI / 2 + (i / n) * 2 * Math.PI
  return [C + r * Math.cos(a), C + r * Math.sin(a)]
}
const ring = (values: number[]) => values.map((v, i) => point(i, values.length, (R * v) / 100).map(n => n.toFixed(1)).join(',')).join(' ')

/**
 * Radar of the user's stats. Each axis is 0 to 100; axes without enough data sit at the centre and read "–".
 * When the scores change (for example a new range is picked) the shape and the numbers ease to the new values.
 */
export default function RadarChart({ axes }: { axes: RadarAxis[] }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const n = axes.length
  const targets = axes.map(a => (a.known ? a.value : 0))
  const [shown, setShown] = useState<number[]>(() => targets.map(() => 0))
  const latest = useRef(shown)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { latest.current = targets; setShown(targets); return }
    const from = latest.current.slice(), t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 1000), e = 1 - Math.pow(1 - k, 3)
      latest.current = targets.map((v, i) => from[i] + (v - from[i]) * e)
      setShown(latest.current)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [targets.join(',')])

  return (
    <svg viewBox={`${-PAD} 0 ${SIZE + PAD * 2} ${SIZE}`} role="img" className="mx-auto w-full max-w-[26rem]"
      aria-label={`Stats: ${axes.map(a => `${a.label} ${a.known ? a.value : 'not enough data'}`).join(', ')}`}>
      <defs>
        <linearGradient id={`rf-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3ddc97" stopOpacity="0.45" /><stop offset="1" stopColor="#3b8cff" stopOpacity="0.3" /></linearGradient>
        <linearGradient id={`rs-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3ddc97" /><stop offset="1" stopColor="#3b8cff" /></linearGradient>
      </defs>
      {LEVELS.map(l => (
        <polygon key={l} points={ring(axes.map(() => l))} fill={l === 100 ? 'rgba(255,255,255,0.03)' : 'none'}
          stroke="rgba(255,255,255,0.1)" strokeDasharray={l === 100 ? undefined : '2 4'} />
      ))}
      {axes.map((a, i) => { const [x, y] = point(i, n, R); return <line key={a.id} x1={C} y1={C} x2={x} y2={y} stroke="rgba(255,255,255,0.1)" /> })}

      <polygon points={ring(shown)} fill={`url(#rf-${uid})`} stroke={`url(#rs-${uid})`} strokeWidth="2" strokeLinejoin="round" />
      {axes.map((a, i) => {
        const [x, y] = point(i, n, (R * shown[i]) / 100)
        return <circle key={a.id} cx={x} cy={y} r={a.known ? 4 : 2.5} fill={a.known ? a.color : 'rgba(255,255,255,0.35)'} stroke={a.known ? 'rgba(6,12,18,0.8)' : undefined} strokeWidth="1.5"><title>{`${a.label}: ${a.hint}`}</title></circle>
      })}

      {axes.map((a, i) => {
        const [x, y] = point(i, n, LABEL_R)
        const anchor = x < C - 8 ? 'end' : x > C + 8 ? 'start' : 'middle'
        return (
          <g key={a.id} textAnchor={anchor}>
            <text x={x} y={y - 4} className="fill-ink/65 text-[11px]">{a.label}</text>
            <text x={x} y={y + 11} className={`text-[13px] font-medium tabular-nums ${a.known ? 'fill-ink' : 'fill-ink/40'}`}>{a.known ? Math.round(shown[i]) : '–'}</text>
            <title>{`${a.label}: ${a.hint}`}</title>
          </g>
        )
      })}
    </svg>
  )
}
