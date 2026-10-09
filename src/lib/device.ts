import { useEffect, useState } from 'react'

/**
 * Phone / tablet detection, done once, so CSS and components can switch to a cheaper (but same-looking) tier.
 * Sets <html data-device="touch"> and, on weaker phones, data-tier="lite" (no visual rules use it).
 */
const mq = (q: string) => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(q).matches

export const isTouchDevice = () => mq('(pointer: coarse)') || mq('(max-width: 1023px)')

/** Few cores / little RAM / Data Saver: these phones get the extra-light tier. */
export function isWeakDevice() {
  if (typeof navigator === 'undefined') return false
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  return (n.deviceMemory !== undefined && n.deviceMemory <= 4) || (n.hardwareConcurrency !== undefined && n.hardwareConcurrency <= 6) || n.connection?.saveData === true
}

export function initDevice() {
  const root = document.documentElement
  const apply = () => {
    const touch = isTouchDevice()
    if (touch) root.dataset.device = 'touch'; else delete root.dataset.device
    if (touch && isWeakDevice()) root.dataset.tier = 'lite'; else delete root.dataset.tier
  }
  apply()
  window.matchMedia('(max-width: 1023px)').addEventListener?.('change', apply)

  // Seamless active-scroll optimization: marks the root during active scrolling
  // so GPU-intensive ambient animations pause and the compositor stays at 60/120fps.
  let scrollTimer = 0
  const onScroll = () => {
    if (root.dataset.visuals === 'extended') return // Extended visuals: nothing ever rests
    if (!root.hasAttribute('data-scrolling')) {
      root.setAttribute('data-scrolling', 'true')
    }
    window.clearTimeout(scrollTimer)
    scrollTimer = window.setTimeout(() => {
      root.removeAttribute('data-scrolling')
    }, 120)
  }
  window.addEventListener('scroll', onScroll, { passive: true })
}

/** True on phones and tablets (re-evaluates when the window crosses the breakpoint). */
export function useIsTouch() {
  const [v, setV] = useState(isTouchDevice)
  useEffect(() => {
    const m = window.matchMedia('(max-width: 1023px)')
    const f = () => setV(isTouchDevice())
    m.addEventListener?.('change', f)
    return () => m.removeEventListener?.('change', f)
  }, [])
  return v
}
