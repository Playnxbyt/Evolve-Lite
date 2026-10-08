import { useCallback, useState } from 'react'

/** Background of the Evolution hero card. `mode` is 'aura' (follows your level) or the id of a live scene. A custom photo, GIF or video, when set, wins over both. */
export interface HeroBg { mode: string; dim: number; blur: number }
export const HERO_LIMITS = { dim: 0.7, blur: 24 }
export const DEFAULT_HERO_BG: HeroBg = { mode: 'aura', dim: 0.25, blur: 0 }
const KEY = 'evolveHeroBg'
const clamp = (v: unknown, max: number, fb: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : fb)

export function useHeroBg() {
  const [bg, setBg] = useState<HeroBg>(() => {
    try {
      const p = JSON.parse(localStorage.getItem(KEY) ?? 'null')
      return { mode: typeof p?.mode === 'string' ? p.mode : DEFAULT_HERO_BG.mode, dim: clamp(p?.dim, HERO_LIMITS.dim, DEFAULT_HERO_BG.dim), blur: clamp(p?.blur, HERO_LIMITS.blur, 0) }
    } catch { return DEFAULT_HERO_BG }
  })
  const update = useCallback((patch: Partial<HeroBg>) => setBg(cur => {
    const n = { ...cur, ...patch }
    try { localStorage.setItem(KEY, JSON.stringify(n)) } catch { /* storage blocked */ }
    return n
  }), [])
  return [bg, update] as const
}

/** Accent pair for the level aura: cool tones early, violet in the middle, gold for the last two ranks. */
export const auraColors = (stage: number): [string, string] =>
  stage >= 18 ? ['#f0b45a', '#ff8a4a'] : stage >= 12 ? ['#7c5cff', '#64e8d3'] : stage >= 8 ? ['#3b8cff', '#a78bfa'] : stage >= 4 ? ['#3ddc97', '#3b8cff'] : ['#64e8d3', '#3b8cff']
