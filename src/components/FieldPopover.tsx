import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface Pos { left: number; width: number; side: 'bottom' | 'top'; edge: number }

/**
 * A dropdown panel for a form field. It is drawn on top of everything (so a scrolling modal cannot clip it) and sits
 * under the field, or above it when there is not enough room below. Clicking anywhere outside closes it.
 */
export default function FieldPopover({ anchor, popRef, label, width = 300, onClose, children }: {
  anchor: RefObject<HTMLElement | null>
  popRef: RefObject<HTMLDivElement | null>
  label: string
  width?: number
  onClose: () => void
  children: ReactNode
}) {
  const [pos, setPos] = useState<Pos | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  const place = () => {
    const a = anchor.current
    if (!a) return
    const r = a.getBoundingClientRect()
    const h = popRef.current?.offsetHeight ?? 360
    const room = window.innerHeight - r.bottom
    const side = room < h + 16 && r.top > room ? 'top' : 'bottom'
    const w = Math.min(width, window.innerWidth - 16)
    setPos({
      side, width: w,
      left: Math.min(Math.max(8, r.left), window.innerWidth - w - 8),
      edge: side === 'bottom' ? r.bottom + 8 : window.innerHeight - r.top + 8,
    })
  }

  useLayoutEffect(place, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const away = (e: PointerEvent) => {
      const t = e.target as Node
      if (!anchor.current?.contains(t) && !popRef.current?.contains(t)) closeRef.current()
    }
    document.addEventListener('pointerdown', away)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true) // follows the field when the modal scrolls
    return () => {
      document.removeEventListener('pointerdown', away)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(
    <div ref={popRef} className="dp-pop dp-fixed" data-side={pos?.side ?? 'bottom'} role="dialog" aria-label={label}
      style={pos ? { left: pos.left, width: pos.width, ...(pos.side === 'bottom' ? { top: pos.edge } : { bottom: pos.edge }) } : { visibility: 'hidden' }}>
      {children}
    </div>,
    document.body,
  )
}
