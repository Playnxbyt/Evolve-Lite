import { useEffect, useState } from 'react'
import type { ClockPrefs, ClockSize } from '../lib/heroPrefs'

const pad = (n: number) => String(n).padStart(2, '0')

/** Digital clock with four looks. Everything is sized in em, so the size setting is a single font-size. */
export default function DigitalClock({ now, prefs, size }: { now: Date; prefs: ClockPrefs; size?: ClockSize | 'xs' }) {
  const h24 = now.getHours()
  const hh = pad(prefs.hour24 ? h24 : h24 % 12 || 12)
  const mm = pad(now.getMinutes())
  const ss = pad(now.getSeconds())
  const ap = h24 < 12 ? 'AM' : 'PM'
  const off = now.getSeconds() % 2 === 1
  const spoken = `${hh}:${mm}${prefs.seconds ? `:${ss}` : ''}${prefs.hour24 ? '' : ` ${ap}`}`

  // The inner span is keyed by the digit, so a changing digit remounts and the flip style can animate it in.
  const cells = (s: string) => s.split('').map((ch, i) => <span key={i} className="clk-cell"><span key={ch} className="clk-d">{ch}</span></span>)
  const colon = <span className="clk-colon" data-off={off}>:</span>

  return (
    <time dateTime={`${pad(h24)}:${mm}:${ss}`} aria-label={spoken} className="clk" data-style={prefs.style} data-size={size ?? prefs.size}
      style={{ ['--clk' as string]: prefs.color }}>
      <span className="clk-main" aria-hidden="true">{cells(hh)}{colon}{cells(mm)}</span>
      {prefs.seconds && <span className="clk-sec" aria-hidden="true">{colon}{cells(ss)}</span>}
      {!prefs.hour24 && <span className="clk-ap" aria-hidden="true">{ap}</span>}
    </time>
  )
}

/** A clock that ticks on its own, so only these few digits re-render each second (not the whole page that shows it). */
export function LiveClock({ prefs, size }: { prefs: ClockPrefs; size?: ClockSize | 'xs' }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    // Without seconds or a blinking colon on screen a once-a-second tick is wasted work; align to the next second instead of drifting.
    let t = 0
    const loop = () => { setNow(new Date()); t = window.setTimeout(loop, 1000 - (Date.now() % 1000) + 5) }
    t = window.setTimeout(loop, 1000 - (Date.now() % 1000) + 5)
    const vis = () => { if (!document.hidden) setNow(new Date()) }
    document.addEventListener('visibilitychange', vis)
    return () => { window.clearTimeout(t); document.removeEventListener('visibilitychange', vis) }
  }, [])
  return <DigitalClock now={now} prefs={prefs} size={size} />
}
