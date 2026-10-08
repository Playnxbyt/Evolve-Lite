import { useEffect, useRef } from 'react'

/** Eases a value toward `pct` and hands every frame to `apply` — with direct DOM writes, so the page above never re-renders while it animates. */
function useEased(pct: number, apply: (v: number) => void) {
  const cur = useRef(0)
  const fn = useRef(apply)
  fn.current = apply
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { cur.current = pct; fn.current(pct); return }
    const from = cur.current, t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 1300)
      cur.current = from + (pct - from) * (1 - Math.pow(1 - k, 3))
      fn.current(cur.current)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [pct])
}

/** The gradient arc and its end dot. Same markup as before, animated without React state. */
export function RingArc({ pct, r, circ }: { pct: number; r: number; circ: number }) {
  const arc = useRef<SVGCircleElement>(null)
  const dot = useRef<SVGCircleElement>(null)
  useEased(pct, v => {
    arc.current?.setAttribute('stroke-dashoffset', String(circ - (v / 100) * circ))
    const d = dot.current
    if (!d) return
    d.setAttribute('cx', String(130 + r * Math.cos((2 * Math.PI * v) / 100)))
    d.setAttribute('cy', String(130 + r * Math.sin((2 * Math.PI * v) / 100)))
    d.style.display = v > 1 ? '' : 'none'
  })
  return (
    <>
      <circle ref={arc} cx="130" cy="130" r={r} fill="none" stroke="url(#ring-gradient)" strokeWidth="12" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ} style={{ filter: 'drop-shadow(0 0 8px rgba(47,208,196,0.4))' }} />
      <circle ref={dot} cx="130" cy="130" r="5" fill="#eafff6" style={{ display: 'none' }} />
    </>
  )
}

/** The big rounded percentage number. */
export function RingValue({ pct }: { pct: number }) {
  const el = useRef<HTMLSpanElement>(null)
  useEased(pct, v => { if (el.current) el.current.textContent = String(Math.round(v)) })
  return <span ref={el}>0</span>
}
