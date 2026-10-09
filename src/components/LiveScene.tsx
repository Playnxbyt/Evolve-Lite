import { useEffect, useId, useMemo, useRef, type CSSProperties } from 'react'
import { isTouchDevice } from '../lib/device'
import { useShell } from '../lib/shell'

export const THEMES = [
  { id: 'dusk', label: 'Dusk', v: { '--sky1': '#050b18', '--sky2': '#15283f', '--sky3': '#6a4d4a', '--glow': '91,210,191', '--aur1': '61,220,151', '--aur2': '59,140,255', '--m-far': '#1b3441', '--m-mid': '#0d202b', '--m-near': '#040b10', '--lit': '#d3dedc' } },
  { id: 'aurora', label: 'Aurora', v: { '--sky1': '#030a14', '--sky2': '#0a2433', '--sky3': '#15505a', '--glow': '61,220,190', '--aur1': '61,255,170', '--aur2': '130,100,255', '--m-far': '#12353e', '--m-mid': '#0a2128', '--m-near': '#030c0f', '--lit': '#cdeee6' } },
  { id: 'twilight', label: 'Twilight', v: { '--sky1': '#0b0a22', '--sky2': '#2b1c50', '--sky3': '#94506e', '--glow': '194,122,180', '--aur1': '200,110,255', '--aur2': '255,150,120', '--m-far': '#2d2250', '--m-mid': '#1a1432', '--m-near': '#0a0716', '--lit': '#f0d6e4' } },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function ridge(seed: number, base: number, amp: number, step: number) {
  const r = rng(seed)
  let y = base, d = `M-50 600 L-50 ${base}`
  for (let x = 0; x <= 1700; x += step) {
    y = y * 0.45 + (base + (r() - 0.5) * 2 * amp) * 0.55
    d += ` L${x} ${y.toFixed(0)}`
  }
  return d + ' L1700 600Z'
}

function pines(seed: number, n: number) {
  const r = rng(seed)
  let d = ''
  for (let i = 0; i < n; i++) {
    const x = r() * 1600, h = 26 + r() * 34, w = h * 0.28, y = 560 - r() * 22
    d += `M${x.toFixed(0)} ${(y - h).toFixed(0)} l${w.toFixed(0)} ${h.toFixed(0)} h${(-2 * w).toFixed(0)}Z `
  }
  return d
}

const par = (x: number, y: number): CSSProperties => ({
  transform: `translate3d(calc(var(--px, 0) * ${x}px), calc(var(--py, 0) * ${y}px), 0)`,
})

/** A layered, animated night landscape: twinkling stars, drifting aurora and mist, fireflies and pointer parallax. */
export default function LiveScene({ theme, lite = false, track = false, hero = false }: { theme: string; lite?: boolean; /** The home hero card's scene: held perfectly still in Moderate and Minimal visuals (see index.css). */ hero?: boolean; /** Drive the parallax from the pointer anywhere in the window (for full-page backdrops). */ track?: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!track || isTouchDevice() || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.matchMedia('(pointer: fine)').matches) return
    const el = root.current
    if (!el) return
    let frame = 0, x = 0, y = 0
    const apply = () => {
      frame = 0
      el.style.setProperty('--px', x.toFixed(3))
      el.style.setProperty('--py', y.toFixed(3))
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      if (document.body.classList.contains('effects-off') || document.body.classList.contains('perf-lite')) return
      x = (e.clientX / window.innerWidth - 0.5) * 2
      y = (e.clientY / window.innerHeight - 0.5) * 2
      if (!frame) frame = requestAnimationFrame(apply)
    }
    const leave = () => { x = 0; y = 0; if (!frame) frame = requestAnimationFrame(apply) }
    window.addEventListener('pointermove', move, { passive: true })
    document.documentElement.addEventListener('pointerleave', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', leave)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [track])
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const t = THEMES.find(x => x.id === theme) ?? THEMES[0]
  const extended = useShell()?.prefs.visuals === 'extended'
  const isTouch = isTouchDevice() && !extended
  const art = useMemo(() => {
    const r = rng(7)
    const starCount = isTouch ? 28 : 70
    const flyCount = isTouch ? 6 : 14
    return {
      stars: Array.from({ length: starCount }, () => ({ x: r() * 100, y: r() * 58, s: 1 + r() * 1.6, d: 2.5 + r() * 4, dl: -r() * 6 })),
      flies: Array.from({ length: flyCount }, () => ({ x: 8 + r() * 84, y: 6 + r() * 26, d: 9 + r() * 9, dl: -r() * 14, dx: (r() - 0.5) * 70 })),
      far: ridge(3, 372, 62, 48), mid: ridge(11, 440, 48, 64), near: ridge(5, 548, 22, 44), pines: pines(21, 46),
    }
  }, [isTouch])

  return (
    <div ref={root} aria-hidden="true" className={`scene${hero ? ' scene-hero' : ''} absolute inset-0 overflow-hidden`} style={t.v as unknown as CSSProperties}>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, var(--sky1) 0%, var(--sky2) 55%, var(--sky3) 100%)' }} />
      {!lite && art.stars.map((s, i) => (
        <i key={i} className="scene-star" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, '--d': `${s.d}s`, '--dl': `${s.dl}s` } as CSSProperties} />
      ))}
      <div className="scene-aurora a" /><div className="scene-aurora b" />
      <div className="scene-glow" />
      {!lite && <div className="scene-shoot" />}

      <div className="scene-par absolute inset-y-0 -inset-x-[3%]" style={par(-5, -2)}>
        <svg viewBox="0 0 1600 600" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 size-full">
          <path d={art.far} style={{ fill: 'var(--m-far)' }} opacity="0.85" />
        </svg>
      </div>

      <div className="scene-par absolute inset-y-0 -inset-x-[3%]" style={par(-11, -4)}>
        <svg viewBox="0 0 1600 600" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 size-full">
          <defs>
            <linearGradient id={`lit-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" style={{ stopColor: 'var(--lit)' }} stopOpacity="0.9" />
              <stop offset="0.7" style={{ stopColor: 'var(--lit)' }} stopOpacity="0.12" />
              <stop offset="1" style={{ stopColor: 'var(--lit)' }} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M180 600 L420 360 L520 300 L575 235 L640 300 L700 270 L800 360 L880 330 L960 215 L1020 118 L1070 190 L1105 168 L1180 270 L1250 305 L1340 400 L1480 600Z" style={{ fill: 'var(--m-mid)' }} />
          <path d="M1020 118 L1070 190 L1105 168 L1180 270 L1250 305 L1340 400 L1480 600 L1290 600 L1230 430 L1160 330 L1090 250 L1050 190Z" fill={`url(#lit-${uid})`} />
          <path d="M575 235 L640 300 L700 270 L800 360 L720 600 L640 440 L600 330Z" fill={`url(#lit-${uid})`} opacity="0.45" />
          <path d="M1020 118 L985 180 L1003 170 L1018 198 L1035 168 L1052 190 L1070 190Z" style={{ fill: 'var(--lit)' }} opacity="0.92" />
          <path d="M575 235 L548 288 L562 280 L575 302 L590 278 L606 294 L640 300Z" style={{ fill: 'var(--lit)' }} opacity="0.75" />
          <path d="M1020 118 L960 215 L880 330 L800 360" fill="none" style={{ stroke: 'var(--lit)' }} strokeOpacity="0.28" strokeWidth="1.4" />
        </svg>
      </div>

      <div className="scene-mist m1" /><div className="scene-mist m2" />

      <div className="scene-par absolute inset-y-0 -inset-x-[3%]" style={par(-20, -6)}>
        <svg viewBox="0 0 1600 600" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 size-full">
          <path d={art.mid} style={{ fill: 'var(--m-mid)' }} opacity="0.9" />
          <path d={art.near} style={{ fill: 'var(--m-near)' }} />
          <path d={art.pines} style={{ fill: 'var(--m-near)' }} />
          <path d={art.near} fill="none" stroke="rgba(var(--glow),0.5)" strokeWidth="1.2" transform="translate(0 -1)" />
        </svg>
      </div>

      {!lite && art.flies.map((f, i) => (
        <i key={i} className="scene-fly" style={{ left: `${f.x}%`, bottom: `${f.y}%`, '--d': `${f.d}s`, '--dl': `${f.dl}s`, '--dx': `${f.dx}px` } as CSSProperties} />
      ))}
    </div>
  )
}
