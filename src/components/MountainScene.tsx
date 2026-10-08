import { useId } from 'react'

const STARS: [number, number, number][] = [
  [30, 30, 1], [70, 60, 0.8], [120, 25, 1.2], [170, 50, 0.8], [250, 30, 1], [300, 65, 0.8],
  [350, 28, 1.2], [380, 70, 0.8], [210, 18, 0.7], [90, 100, 0.7], [330, 105, 0.7],
]

export default function MountainScene({ className = '' }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const ref = (n: string) => `url(#${n}-${uid})`
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#03080e" />
          <stop offset="0.5" stopColor="#09202d" />
          <stop offset="0.8" stopColor="#173f48" />
          <stop offset="1" stopColor="#4a3a2c" />
        </linearGradient>
        <radialGradient id={`glow-${uid}`} cx="0.5" cy="0.82" r="0.6">
          <stop offset="0" stopColor="#ff9a4a" stopOpacity="0.6" />
          <stop offset="0.5" stopColor="#ff9a4a" stopOpacity="0.14" />
          <stop offset="1" stopColor="#ff9a4a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`lit-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b9c9cb" />
          <stop offset="1" stopColor="#163442" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={ref('sky')} />
      <rect width="400" height="300" fill={ref('glow')} />
      {STARS.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#e6fbff" opacity="0.8">
          {i % 3 === 0 && <animate attributeName="opacity" values="0.3;0.95;0.3" dur={`${3 + (i % 3)}s`} repeatCount="indefinite" />}
        </circle>
      ))}
      <path d="M0 215 L45 180 L85 200 L135 160 L185 205 L235 175 L290 210 L345 172 L400 210 L400 300 L0 300Z" fill="#14323c" opacity="0.92" />
      <path d="M30 300 L140 175 L175 130 L200 72 L228 122 L250 108 L290 170 L380 300Z" fill="#081620" />
      <path d="M200 72 L228 122 L250 108 L290 170 L380 300 L290 300 L262 210 L232 170 L212 115Z" fill={ref('lit')} opacity="0.85" />
      <path d="M200 72 L183 106 L194 101 L201 116 L210 100 L221 111 L228 122Z" fill="#e6f1f0" opacity="0.8" />
      <path d="M200 72 L175 130 L140 175" fill="none" stroke="#8dbcc6" strokeOpacity="0.25" strokeWidth="1.2" />
      <path d="M0 262 C70 238 140 258 220 246 C300 234 350 252 400 240 L400 300 L0 300Z" fill="#050e14" />
      <path d="M0 262 C70 238 140 258 220 246 C300 234 350 252 400 240" fill="none" stroke="#ff9a4a" strokeOpacity="0.45" strokeWidth="1.2" />
    </svg>
  )
}
