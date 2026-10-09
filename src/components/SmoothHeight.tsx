import { useEffect, useRef, type ReactNode } from 'react'

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

/**
 * Wraps content whose height can change on its own (a task leaving the focus card, a different task arriving).
 * Instead of everything below jumping to the new height in one frame, the box glides from the old height to the new one.
 * At rest the height is plain `auto`, so nothing else about the layout changes. Skipped for "reduce motion".
 */
export default function SmoothHeight({ children, onMotion, className }: { children: ReactNode; onMotion?: (moving: boolean) => void; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const anim = useRef<Animation | null>(null)
  const last = useRef(0)
  const motion = useRef(onMotion)
  motion.current = onMotion

  useEffect(() => {
    const el = box.current, body = inner.current
    if (!el || !body || typeof ResizeObserver === 'undefined') return
    last.current = body.getBoundingClientRect().height
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const minimal = document.documentElement.dataset.visuals === 'minimal'

    const ro = new ResizeObserver(() => {
      const to = body.getBoundingClientRect().height
      // Where the box is right now (it may be halfway through an earlier glide), so a quick second change continues smoothly.
      const from = anim.current ? el.getBoundingClientRect().height : last.current
      last.current = to
      if (minimal || reduced.matches || Math.abs(to - from) < 3 || !el.animate) {
        // Avoid per-frame height/layout work on lower-powered phones in Minimal visuals.
        anim.current?.cancel()
        el.style.height = ''
        el.style.overflow = ''
        motion.current?.(false)
        return
      }
      anim.current?.cancel()
      el.style.overflow = 'hidden'
      motion.current?.(true)
      const a = el.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 340, easing: EASE })
      anim.current = a
      const done = () => {
        if (anim.current !== a) return
        anim.current = null
        el.style.overflow = ''
        motion.current?.(false)
      }
      a.onfinish = done
      a.oncancel = done
    })
    ro.observe(body)
    return () => { ro.disconnect(); anim.current?.cancel(); el.style.overflow = '' }
  }, [])

  return (
    <div ref={box} className={className}>
      <div ref={inner}>{children}</div>
    </div>
  )
}
