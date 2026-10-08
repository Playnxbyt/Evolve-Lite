import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useShell } from '../lib/shell'
import { dayKey, streak, tasksOn } from '../lib/core'

/* "Mochi", a small companion that peeks in from the right edge of every page.
   It reacts to your day: cheers when you finish a task, nudges you about what is next,
   gets a little sad if the evening comes and nothing is done, and sleeps late at night.
   It is pinned to the screen edge (never to page content), and every animation is transform/opacity only,
   so it stays put and moves smoothly. */

type Mood = 'idle' | 'happy' | 'cheer' | 'sleep' | 'sad'

const KEY = 'evolve.pet.hidden'
const readHidden = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }
const writeHidden = (v: boolean) => { try { localStorage.setItem(KEY, v ? '1' : '0') } catch { /* storage unavailable */ } }
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

const FX_X = [-74, -56, -40, -24, -64, -34]
const FX_Y = [-40, -62, -78, -52, -88, -30]

export default function Pet() {
  const shell = useShell()
  const [hidden, setHidden] = useState(readHidden)
  const [now, setNow] = useState(() => new Date())
  const [burst, setBurst] = useState<Mood | null>(null)
  const [bubble, setBubble] = useState<string | null>(null)
  const [fx, setFx] = useState(0)
  const [near, setNear] = useState(false)
  const box = useRef<HTMLButtonElement>(null)
  const bubbleTimer = useRef(0)
  const burstTimer = useRef(0)
  const tipN = useRef(0)
  const prevDone = useRef<number | null>(null)

  const state = shell?.state
  const tasks = state ? tasksOn(state, now) : []
  const doneMap = state ? state.completions[dayKey(now)] ?? {} : {}
  const doneCount = tasks.filter(t => doneMap[t.id]).length
  const total = tasks.length
  const left = total - doneCount
  const pct = total ? Math.round((doneCount / total) * 100) : 0
  const hour = now.getHours()
  const name = state?.name?.trim() ?? ''
  const next = tasks.filter(t => !doneMap[t.id]).sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))[0]
  const days = state ? streak(state, now) : 0

  // always-fresh copy for timers, so they never read stale values
  const live = useRef({ name, hour, total, left, pct, next: next?.text ?? '', days })
  live.current = { name, hour, total, left, pct, next: next?.text ?? '', days }

  const say = useCallback((text: string, ms = 6500) => {
    setBubble(text)
    window.clearTimeout(bubbleTimer.current)
    bubbleTimer.current = window.setTimeout(() => setBubble(null), ms)
  }, [])

  const act = useCallback((mood: Mood, ms: number, text?: string) => {
    setBurst(mood)
    setFx(n => n + 1)
    window.clearTimeout(burstTimer.current)
    burstTimer.current = window.setTimeout(() => setBurst(null), ms)
    if (text) say(text, Math.max(ms + 2500, 5000))
  }, [say])

  const mood: Mood = burst ?? (hour >= 23 || hour < 5 ? 'sleep' : total > 0 && pct === 100 ? 'happy' : total > 0 && pct === 0 && hour >= 17 ? 'sad' : 'idle')

  // clock tick
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(id)
  }, [])

  // hello, once
  useEffect(() => {
    const id = window.setTimeout(() => {
      const { name: n, hour: h } = live.current
      const who = n ? `, ${n}` : ''
      say(h < 5 ? 'Still up? Rest matters too.' : h < 12 ? `Good morning${who}!` : h < 17 ? `Good afternoon${who}!` : h < 22 ? `Good evening${who}!` : 'Winding down? Nice work today.', 5000)
    }, 1600)
    return () => window.clearTimeout(id)
  }, [say])

  // a gentle, useful nudge every little while
  useEffect(() => {
    const id = window.setInterval(() => {
      const l = live.current
      if (l.hour >= 23 || l.hour < 5) return
      const tips: string[] = []
      if (l.total === 0) tips.push('Nothing planned yet. Add a habit and I will cheer you on!')
      else if (l.left === 0) tips.push('Everything is done today. I am so proud of you!')
      else {
        if (l.next) tips.push(`Next up: ${l.next}`)
        tips.push(`${l.left} left today. You have got this!`)
        if (l.pct >= 50) tips.push('Over halfway there, keep going!')
        if (l.days > 1) tips.push(`${l.days}-day streak. Do not break it!`)
      }
      say(tips[tipN.current++ % tips.length], 6000)
    }, 80000)
    return () => window.clearInterval(id)
  }, [say])

  // celebrate whenever a task gets checked off
  useEffect(() => {
    if (prevDone.current !== null && doneCount > prevDone.current) {
      if (total > 0 && doneCount === total) act('cheer', 3400, 'All done for today! You did it!')
      else act('cheer', 1900, pick(['Nice one!', 'Yay, keep going!', 'One down!', 'You are on a roll!']))
    }
    prevDone.current = doneCount
  }, [doneCount, total, act])

  // the eyes follow your cursor
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    let raf = 0
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = box.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const c = (v: number) => Math.max(-1, Math.min(1, v)) * 2.6
        el.style.setProperty('--ex', `${c((e.clientX - (r.left + r.width / 2)) / 260)}px`)
        el.style.setProperty('--ey', `${c((e.clientY - (r.top + r.height / 2)) / 260)}px`)
      })
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(raf) }
  }, [hidden])

  // the command palette can hide / show the pet
  useEffect(() => {
    const toggle = () => setHidden(h => { writeHidden(!h); return !h })
    window.addEventListener('evolve:pet', toggle)
    return () => window.removeEventListener('evolve:pet', toggle)
  }, [])

  useEffect(() => () => { window.clearTimeout(bubbleTimer.current); window.clearTimeout(burstTimer.current) }, [])

  if (!shell) return null

  const poke = () => {
    if (mood === 'sleep') { setFx(n => n + 1); say('Zzz... five more minutes. You should sleep too!'); return }
    act('happy', 2200, pick(['Hehe, that tickles!', 'Purr purr...', 'I love you too!', 'Back to it, you can do this!']))
  }
  const hide = () => { setHidden(true); writeHidden(true); setBubble(null) }
  const show = () => { setHidden(false); writeHidden(false) }

  if (hidden) {
    return (
      <button aria-label="Bring back your pet" onClick={show}
        className="pet-back glass fixed right-0 z-30 grid h-11 w-9 place-items-center rounded-l-2xl text-teal">
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
          <ellipse cx="6.5" cy="10" rx="2" ry="2.6" /><ellipse cx="10.5" cy="6.2" rx="2" ry="2.6" /><ellipse cx="15.5" cy="6.2" rx="2" ry="2.6" /><ellipse cx="19" cy="10" rx="2" ry="2.6" />
          <path d="M12 11c-3 0-5.6 2.6-5.6 5.2 0 1.8 1.3 2.8 3 2.8 1.1 0 1.8-.6 2.6-.6s1.5.6 2.6.6c1.7 0 3-1 3-2.8C17.6 13.6 15 11 12 11z" />
        </svg>
      </button>
    )
  }

  const sleeping = mood === 'sleep'
  const engaged = !sleeping && (bubble !== null || burst !== null || near)
  const happyEyes = mood === 'happy' || mood === 'cheer'
  const dark = '#0b1a22'

  return (
    <div data-mood={mood} data-engaged={engaged} className="pet">
      {bubble && (
        <div key={bubble} role="status" aria-live="polite"
          className="pet-bubble glass absolute bottom-full right-3 mb-1 w-max max-w-[15rem] rounded-2xl px-3.5 py-2.5 text-sm leading-snug">
          {bubble}
          <button onClick={hide} className="mt-1.5 block text-[11px] text-ink/55 transition-colors hover:text-teal">Hide pet</button>
        </div>
      )}

      {/* particles live outside the clip box so they can fly out over the page */}
      <div className="pet-fxlayer" aria-hidden="true">
        {fx > 0 && FX_X.map((x, i) => (
          <span key={`${fx}-${i}`} className={`pet-fx ${mood === 'cheer' ? 'gold' : ''}`}
            style={{ '--dx': `${x}px`, '--dy': `${FX_Y[i]}px`, '--d': `${i * 0.07}s` } as CSSProperties}>{mood === 'cheer' ? '✦' : '♥'}</span>
        ))}
        {sleeping && <span className="pet-zs"><i>z</i><i>z</i><i>Z</i></span>}
      </div>

      {/* the clip box is glued to the screen edge: whatever sticks out past it is the "wall" the cat hides behind */}
      <div className="pet-clip">
        <div className="pet-slide">
          <button ref={box} onClick={poke} onPointerEnter={() => setNear(true)} onPointerLeave={() => setNear(false)}
            onFocus={() => setNear(true)} onBlur={() => setNear(false)}
            aria-label="Pet your companion" className="pet-btn block">
          <div className="pet-jump">
            <svg viewBox="0 0 120 120" className="pet-svg" role="img" aria-hidden="true">
              <defs>
                <linearGradient id="pet-fur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6fffd" /><stop offset="1" stopColor="#a4ebdd" /></linearGradient>
              </defs>
              <path className="pet-tail" d="M94 94C114 94 120 72 106 60" fill="none" stroke="#8fe6d6" strokeWidth="9" strokeLinecap="round" />
              <g className="pet-body">
                <g className="pet-ear l"><polygon points="27,46 27,15 53,31" fill="#bff3ea" stroke="#bff3ea" strokeWidth="6" strokeLinejoin="round" /><polygon points="33,37 33,24 44,31" fill="#ffb3c6" /></g>
                <g className="pet-ear r"><polygon points="93,46 93,15 67,31" fill="#bff3ea" stroke="#bff3ea" strokeWidth="6" strokeLinejoin="round" /><polygon points="87,37 87,24 76,31" fill="#ffb3c6" /></g>
                <ellipse cx="42" cy="104" rx="11" ry="6.5" fill="#d7faf3" /><ellipse cx="78" cy="104" rx="11" ry="6.5" fill="#d7faf3" />
                <ellipse cx="60" cy="70" rx="45" ry="39" fill="url(#pet-fur)" stroke="rgba(6,14,20,0.28)" strokeWidth="1.5" />
                <ellipse cx="42" cy="48" rx="15" ry="7" fill="#fff" opacity="0.45" transform="rotate(-20 42 48)" />
                <path d="M40 94Q60 106 80 94" fill="none" stroke="#57b9f5" strokeWidth="4.5" strokeLinecap="round" />
                <circle cx="60" cy="101" r="4.2" fill="#f0b45a" /><path d="M58.500 101h3" stroke="#b9822b" strokeWidth="1.200" strokeLinecap="round" />

                {/* eyes */}
                {sleeping ? (
                  <g fill="none" stroke={dark} strokeWidth="2.600" strokeLinecap="round"><path d="M37 67Q44 73 51 67" /><path d="M69 67Q76 73 83 67" /></g>
                ) : happyEyes ? (
                  <g fill="none" stroke={dark} strokeWidth="3" strokeLinecap="round"><path d="M37 69Q44 59 51 69" /><path d="M69 69Q76 59 83 69" /></g>
                ) : (
                  <g className="pet-eyes">
                    {[44, 76].map(x => (
                      <g key={x} transform={`translate(${x} ${mood === 'sad' ? 68 : 66})`}>
                        <ellipse rx="5.600" ry="7" fill={dark} />
                        <g className="pet-pupil"><circle cx="1.600" cy="-2.400" r="2.200" fill="#fff" /><circle cx="-1.800" cy="2" r="1" fill="#fff" opacity="0.8" /></g>
                      </g>
                    ))}
                    {mood === 'sad' && <g stroke={dark} strokeWidth="2" strokeLinecap="round"><path d="M36 56L51 60" /><path d="M84 56L69 60" /></g>}
                  </g>
                )}
                <ellipse cx="32" cy="78" rx="6.500" ry="3.800" fill="#ff9fb8" opacity="0.55" /><ellipse cx="88" cy="78" rx="6.500" ry="3.800" fill="#ff9fb8" opacity="0.55" />
                {mood === 'cheer' ? (
                  <path d="M52 76Q60 92 68 76Z" fill="#ff7d96" stroke={dark} strokeWidth="2" strokeLinejoin="round" />
                ) : mood === 'sad' ? (
                  <path d="M54 82Q60 76 66 82" fill="none" stroke={dark} strokeWidth="2.200" strokeLinecap="round" />
                ) : (
                  <path d="M53 77Q56.500 82 60 77Q63.500 82 67 77" fill="none" stroke={dark} strokeWidth="2.200" strokeLinecap="round" strokeLinejoin="round" />
                )}
                <g stroke={dark} strokeWidth="1.200" strokeLinecap="round" opacity="0.35"><path d="M20 72L8 70" /><path d="M20 77L8 80" /><path d="M100 72L112 70" /><path d="M100 77L112 80" /></g>
              </g>
              {/* a little paw hooked over the edge of the screen (fades out when the cat leans further out) */}
              <g className="pet-paw">
                <ellipse cx="88" cy="98" rx="10" ry="7.5" fill="#d7faf3" stroke="rgba(6,14,20,0.28)" strokeWidth="1.5" />
                <g stroke="#8fcfc3" strokeWidth="1.3" strokeLinecap="round"><path d="M91 93V99" /><path d="M95 95V101" /></g>
              </g>
            </svg>
          </div>
          </button>
        </div>
      </div>
    </div>
  )
}
