import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  id?: string
  children: ReactNode
  /** Fires true when the height animation starts and false when it ends, so the page can pause heavy background loops. */
  onMotion?: (moving: boolean) => void
}

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

/**
 * Height-animated disclosure. The animation always starts from the height the panel has right now, so
 * opening, closing and changing your mind halfway all glide instead of snapping. The height is only
 * pinned to pixels while it moves; at rest it is `auto`, so content can still change size freely.
 */
export default function Collapse({ open, id, children, onMotion }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const anim = useRef<Animation | null>(null)
  const mounted = useRef(false)

  useLayoutEffect(() => {
    const el = box.current, inner = body.current
    if (!el || !inner) return
    if (!mounted.current) { mounted.current = true; el.style.height = open ? 'auto' : '0px'; return }

    const from = el.getBoundingClientRect().height // read before cancelling, so a half-finished animation is picked up where it is
    anim.current?.cancel()
    const to = open ? inner.offsetHeight : 0
    const rest = open ? 'auto' : '0px'
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof el.animate !== 'function' || Math.abs(from - to) < 1
    el.style.height = `${to}px`
    if (still) { el.style.height = rest; onMotion?.(false); return }

    onMotion?.(true)
    const a = el.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: open ? 560 : 440, easing: EASE })
    anim.current = a
    a.onfinish = () => { el.style.height = rest; anim.current = null; onMotion?.(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => () => anim.current?.cancel(), [])

  return (
    <div ref={box} id={id} inert={!open} className="overflow-hidden" style={{ contain: 'layout style' }}>
      <div ref={body}>{children}</div>
    </div>
  )
}
