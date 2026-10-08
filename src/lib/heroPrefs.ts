import { useEffect, useState } from 'react'

/** Customisation for the hero card (clock + ring text). Kept in this browser only, like the ring image. */
export type ClockStyle = 'classic' | 'neon' | 'flip' | 'led'
export type ClockSize = 'sm' | 'md' | 'lg'

export interface ClockPrefs {
  style: ClockStyle
  size: ClockSize
  color: string
  hour24: boolean
  seconds: boolean
  date: boolean
}
export interface RingPrefs {
  label: string
  count: boolean
}

export const CLOCK_STYLES: { id: ClockStyle; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'neon', label: 'Neon' },
  { id: 'flip', label: 'Flip' },
  { id: 'led', label: 'LED' },
]
export const CLOCK_SIZES: { id: ClockSize; label: string }[] = [
  { id: 'sm', label: 'Small' },
  { id: 'md', label: 'Medium' },
  { id: 'lg', label: 'Large' },
]
export const CLOCK_COLORS = [
  { id: '#64e8d3', label: 'Teal' },
  { id: '#3ddc97', label: 'Mint' },
  { id: '#57b9f5', label: 'Blue' },
  { id: '#a78bfa', label: 'Violet' },
  { id: '#f0b45a', label: 'Amber' },
  { id: '#edf7f8', label: 'White' },
]

export const DEFAULT_CLOCK: ClockPrefs = { style: 'classic', size: 'md', color: '#64e8d3', hour24: false, seconds: false, date: true }
export const DEFAULT_RING_LABEL = 'Today\u2019s Progress'
export const RING_LABEL_MAX = 24
export const DEFAULT_RING: RingPrefs = { label: DEFAULT_RING_LABEL, count: true }

const CLOCK_KEY = 'evolveClock', RING_KEY = 'evolveRingText'

function cleanClock(v: Record<string, unknown>): Partial<ClockPrefs> {
  const out: Partial<ClockPrefs> = {}
  if (CLOCK_STYLES.some(s => s.id === v.style)) out.style = v.style as ClockStyle
  if (CLOCK_SIZES.some(s => s.id === v.size)) out.size = v.size as ClockSize
  if (CLOCK_COLORS.some(c => c.id === v.color)) out.color = v.color as string
  if (typeof v.hour24 === 'boolean') out.hour24 = v.hour24
  if (typeof v.seconds === 'boolean') out.seconds = v.seconds
  if (typeof v.date === 'boolean') out.date = v.date
  return out
}
function cleanRing(v: Record<string, unknown>): Partial<RingPrefs> {
  const out: Partial<RingPrefs> = {}
  if (typeof v.label === 'string') out.label = v.label.slice(0, RING_LABEL_MAX)
  if (typeof v.count === 'boolean') out.count = v.count
  return out
}

function load<T extends object>(key: string, fallback: T, clean: (v: Record<string, unknown>) => Partial<T>): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const v = JSON.parse(raw) as unknown
    return v && typeof v === 'object' ? { ...fallback, ...clean(v as Record<string, unknown>) } : fallback
  } catch { return fallback }
}
function save(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* storage blocked or full */ }
}

export function useHeroPrefs() {
  const [clock, setClockState] = useState<ClockPrefs>(() => load(CLOCK_KEY, DEFAULT_CLOCK, cleanClock))
  const [ring, setRingState] = useState<RingPrefs>(() => load(RING_KEY, DEFAULT_RING, cleanRing))
  useEffect(() => save(CLOCK_KEY, clock), [clock])
  useEffect(() => save(RING_KEY, ring), [ring])
  return {
    clock,
    ring,
    setClock: (patch: Partial<ClockPrefs>) => setClockState(c => ({ ...c, ...patch })),
    setRing: (patch: Partial<RingPrefs>) => setRingState(r => ({ ...r, ...patch })),
    resetClock: () => setClockState(DEFAULT_CLOCK),
    resetRing: () => setRingState(DEFAULT_RING),
  }
}
