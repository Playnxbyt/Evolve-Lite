import { useEffect, useRef, useState } from 'react'

interface Props {
  checked: boolean
  onChange: () => void
  label: string
  className?: string
}

/** Completion toggle: a glass pill that melts into a glowing orb when switched on. */
export default function Switch({ checked, onChange, label, className = '' }: Props) {
  // The ring + pop only play at the moment of completion, not when an already-done task first renders.
  const [pop, setPop] = useState(false)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (!checked) { setPop(false); return }
    setPop(true)
    const t = window.setTimeout(() => setPop(false), 1500)
    return () => window.clearTimeout(t)
  }, [checked])

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-pop={pop}
      onClick={e => { e.stopPropagation(); onChange() }}
      className={`switch ${className}`}
    >
      <span className="switch-glow" aria-hidden="true" />
      <span className="switch-ripple" aria-hidden="true" />
      <span className="switch-track" aria-hidden="true" />
      <span className="switch-thumb">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1" />
        </svg>
      </span>
    </button>
  )
}
