import { useCallback, useEffect, useState } from 'react'

/** How the Habits page looks. Edited from the Profile tab, kept in this browser only (the pictures live in IndexedDB). */
export type PageSrc = 'default' | 'scene' | 'photo'
export type CardSrc = 'glass' | 'scene' | 'photo'

export interface HabitsLook {
  /** Page background: the app wallpaper, a live scene, or your own photo / GIF / video. */
  pageSrc: PageSrc
  pageTheme: string
  /** Blur of the page background, in px. */
  pageBlur: number
  /** How much the page background is darkened, 0 to 0.7. */
  pageDim: number
  /** Card background: plain glass, a live scene, or your own photo / GIF. */
  cardSrc: CardSrc
  cardTheme: string
  /** Frosting of the glass cards (blur of whatever sits behind them), in px. */
  cardFrost: number
  /** Blur of the picture inside the cards, in px. */
  cardBlur: number
  /** How much the card picture is darkened, 0 to 0.7. */
  cardDim: number
}

export const DEFAULT_LOOK: HabitsLook = {
  pageSrc: 'default', pageTheme: 'dusk', pageBlur: 28, pageDim: 0.35,
  cardSrc: 'glass', cardTheme: 'aurora', cardFrost: 22, cardBlur: 6, cardDim: 0.35,
}
export const LIMITS = { blur: 40, cardBlur: 30, dim: 0.7 }

const KEY = 'evolveHabitsLook'
const num = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback

function load(): HabitsLook {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Record<string, unknown> | null
    if (!p || typeof p !== 'object') return DEFAULT_LOOK
    const d = DEFAULT_LOOK
    return {
      pageSrc: p.pageSrc === 'scene' || p.pageSrc === 'photo' ? p.pageSrc : d.pageSrc,
      pageTheme: typeof p.pageTheme === 'string' ? p.pageTheme : d.pageTheme,
      pageBlur: num(p.pageBlur, 0, LIMITS.blur, d.pageBlur),
      pageDim: num(p.pageDim, 0, LIMITS.dim, d.pageDim),
      cardSrc: p.cardSrc === 'scene' || p.cardSrc === 'photo' ? p.cardSrc : d.cardSrc,
      cardTheme: typeof p.cardTheme === 'string' ? p.cardTheme : d.cardTheme,
      cardFrost: num(p.cardFrost, 0, LIMITS.blur, d.cardFrost),
      cardBlur: num(p.cardBlur, 0, LIMITS.cardBlur, d.cardBlur),
      cardDim: num(p.cardDim, 0, LIMITS.dim, d.cardDim),
    }
  } catch { return DEFAULT_LOOK }
}

export function useHabitsLook() {
  const [look, setLook] = useState<HabitsLook>(load)
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(look)) } catch { /* storage blocked or full */ } }, [look])
  const set = useCallback((patch: Partial<HabitsLook>) => setLook(cur => ({ ...cur, ...patch })), [])
  const reset = useCallback(() => setLook(DEFAULT_LOOK), [])
  return { look, set, reset }
}
