import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { GOAL_TERMS, type AppState, type Goal, type GoalTerm } from '../lib/core'
import GoalJourneyModal from './GoalJourneyModal'
import { STAGES, badgeSrc, buildEvolution, type Achievement, type GoalView, type GrowthArea } from '../lib/evolution'
import { auraColors, useHeroBg } from '../lib/evolutionHero'
import { isHabit } from '../lib/habitStats'
import { useWallpaper } from '../lib/wallpaper'
import Collapse from './Collapse'
import GoalModal, { type GoalFields } from './GoalModal'
import { Icon } from './Icons'
import HeroBackdropModal from './HeroBackdropModal'
import LiveScene from './LiveScene'
import TopBar from './TopBar'
import type { Tab } from './Sidebar'
import { isTouchDevice } from '../lib/device'

interface Props {
  state: AppState
  onNavigate: (t: Tab) => void
  onAddGoal: (f: GoalFields) => void
  onUpdateGoal: (id: string, f: Partial<Goal>) => void
  onRemoveGoal: (id: string) => void
}

const eyebrow = 'text-[11px] font-medium uppercase tracking-[0.18em]'
const delay = (n: number) => ({ animationDelay: `${n * 90}ms` })
const num = (n: number) => n.toLocaleString('en-US')
const plural = (n: number, w: string) => `${num(n)} ${w}${n === 1 ? '' : 's'}`
const RING_R = 39
const ACH_PREVIEW = 4
const CIRC = 2 * Math.PI * RING_R
const bar = (c: string) => `linear-gradient(90deg, ${c}, #3b8cff)`

const AREA_COLORS: Record<string, [string, string]> = {
  academics: ['#3b8cff', '#64e8d3'], fitness: ['#3ddc97', '#b6f36b'], skills: ['#ffb84d', '#ff7a59'],
  discipline: ['#64e8d3', '#3b8cff'], personal: ['#b18cff', '#ff7ac6'],
}

/** Completion ring with the percentage inside. An area with nothing scheduled gets a dotted empty ring instead of a made-up 0%. */
function Ring({ score, ready, colors }: { score: number | null; ready: boolean; colors: [string, string] }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  return (
    <div className="relative size-24">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90 overflow-visible" aria-hidden="true">
        <defs><linearGradient id={`ev-${id}`} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={colors[0]} /><stop offset="100%" stopColor={colors[1]} /></linearGradient></defs>
        <circle cx="50" cy="50" r={RING_R - 8} fill="rgba(255,255,255,0.035)" />
        <circle cx="50" cy="50" r={RING_R} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="8" strokeLinecap={score === null ? 'round' : undefined} strokeDasharray={score === null ? '0.1 7.4' : undefined} />
        {score !== null && score > 0 && (
          <circle cx="50" cy="50" r={RING_R} fill="none" stroke={`url(#ev-${id})`} strokeWidth="8" strokeLinecap="round" className="hb-ring"
            style={{ filter: `drop-shadow(0 0 5px ${colors[0]}77)` }} strokeDasharray={CIRC} strokeDashoffset={ready ? CIRC - (score / 100) * CIRC : CIRC} />
        )}
      </svg>
      <span className="absolute inset-0 grid place-items-center">
        {score === null ? <span className="text-lg text-ink/35">–</span> : <span className="flex items-start text-[22px] font-semibold leading-none tabular-nums">{score}<span className="ml-0.5 mt-0.5 text-[10px] font-medium text-ink/55">%</span></span>}
      </span>
    </div>
  )
}

/** Rank badge. Levels not reached yet are greyed out. */
function Badge({ i, locked, glow, className }: { i: number; locked?: boolean; glow?: boolean; className: string }) {
  return <img src={badgeSrc(i)} alt="" draggable={false} className={`${className} select-none object-contain ${locked ? 'ev-badge-locked' : glow ? 'ev-badge-glow' : ''}`} />
}

/** Premium presentation for the current rank badge. The badge asset remains the source of truth;
 * this wrapper adds depth, precision rings and restrained ambient light so it feels like part of EVOLVE. */
function PremiumRankBadge({ stage, title, level }: { stage: number; title: string; level: number }) {
  return (
    <div className="ev-rank-showcase" aria-label={`Current rank: ${title}, level ${level}`}>
      <div className="ev-rank-aura" aria-hidden="true" />
      <div className="ev-rank-ring ev-rank-ring-outer" aria-hidden="true" />
      <div className="ev-rank-ring ev-rank-ring-inner" aria-hidden="true" />

      <div className="ev-rank-surface">
        <div className="ev-rank-highlight" aria-hidden="true" />
        <img
          src={badgeSrc(stage)}
          alt=""
          draggable={false}
          className="ev-premium-badge"
        />
        <div className="ev-rank-reflection" aria-hidden="true" />
      </div>

      <div className="ev-rank-meta">
        <span>LEVEL {level}</span>
        <strong>{title}</strong>
      </div>
    </div>
  )
}

/** Hero background that follows your level: drifting colour orbs and a faint seal of your current badge. */
function LevelAura({ stage }: { stage: number }) {
  const [a, b] = auraColors(stage)
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden bg-[#050c13]">
      <div className="ev-orb" style={{ '--c': a, left: '-12%', top: '-35%', width: '62%', height: '130%' } as CSSProperties} />
      <div className="ev-orb b" style={{ '--c': b, right: '-8%', bottom: '-45%', width: '58%', height: '120%' } as CSSProperties} />
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px)', backgroundSize: '44px 44px', maskImage: 'radial-gradient(ellipse at 75% 50%, #000, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at 75% 50%, #000, transparent 70%)' }} />
      <img src={badgeSrc(stage)} alt="" draggable={false} className="ev-seal absolute -right-8 top-1/2 hidden h-[150%] -translate-y-1/2 opacity-30 sm:block" />
    </div>
  )
}

const RING_U = 76
const CIRC_U = 2 * Math.PI * RING_U

/** The ultimate goal: the one big thing, shown apart from the everyday goals. */
function UltimateCard({ g, now, ready, fmt, onSet, onEdit, onBump, onOpen }: { g: GoalView | null; now: Date; ready: boolean; fmt: (d: Date) => string; onSet: () => void; onEdit: () => void; onBump?: () => void; onOpen: () => void }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const ambition = g?.goal.kind === 'ambition'
  const span = g?.goal.deadline ? Math.max(1, Math.round((g.goal.deadline - g.goal.createdAt) / 86400000)) : 0
  // A goal with steps shows the share of steps done; one without shows how much of the time to the target date has passed.
  const pct = !g ? 0 : !ambition || g.measurable || g.done ? g.pct : span ? Math.min(100, Math.round(((g.daysIn - 1) / span) * 100)) : 0
  const unit = g?.goal.unit ? ` ${g.goal.unit}` : ''
  const days = g ? Math.max(1, Math.round((today - g.goal.createdAt) / 86400000) + 1) : 0
  const left = g ? Math.max(0, g.goal.target - g.current) : 0
  const rate = g && !ambition && days >= 7 ? g.current / days : 0
  const eta = g && !ambition && !g.done && rate > 0 ? new Date(today + Math.ceil(left / rate) * 86400000) : null
  const nextStep = g?.goal.milestones.find(m => !m.doneAt)
  const showEta = eta && eta.getFullYear() - now.getFullYear() < 10
  return (
    <section className="fade-up mt-12" style={delay(4)} aria-labelledby="ev-ult">
      <div className="ev-ult">
        <img src={badgeSrc(19)} alt="" aria-hidden="true" draggable={false} className="ev-seal pointer-events-none absolute -right-12 top-1/2 hidden h-[150%] -translate-y-1/2 opacity-[0.15] sm:block" />
        <div className="relative grid gap-8 p-6 sm:p-9 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-12">
          <div className="relative mx-auto size-44 shrink-0 sm:size-48">
            <svg viewBox="0 0 180 180" className="size-full -rotate-90 overflow-visible" aria-hidden="true">
              <defs><linearGradient id={`ug-${id}`} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f0b45a" /><stop offset="100%" stopColor="#64e8d3" /></linearGradient></defs>
              <circle cx="90" cy="90" r={RING_U} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="12" strokeDasharray={g ? undefined : '0.1 11'} strokeLinecap={g ? undefined : 'round'} />
              {g && pct > 0 && <circle cx="90" cy="90" r={RING_U} fill="none" stroke={`url(#ug-${id})`} strokeWidth="12" strokeLinecap="round" className="hb-ring"
                style={{ filter: 'drop-shadow(0 0 8px rgba(240,180,90,0.55))' }} strokeDasharray={CIRC_U} strokeDashoffset={ready ? CIRC_U - (pct / 100) * CIRC_U : CIRC_U} />}
            </svg>
            <span className="absolute inset-0 grid place-items-center text-center">
              {g ? (
                ambition && !g.measurable && !g.done ? (
                  <span><span className="block text-5xl font-semibold leading-none tabular-nums">{g.goal.deadline ? Math.max(0, g.daysLeft ?? 0) : g.daysIn}</span>
                    <span className="mt-1.5 block text-[11px] uppercase tracking-[0.18em] text-ink/50">{g.goal.deadline ? 'days left' : g.daysIn === 1 ? 'day in' : 'days in'}</span></span>
                ) : (
                  <span><span className="flex items-start justify-center text-5xl font-semibold leading-none tabular-nums">{pct}<span className="mt-1.5 text-base font-medium text-ink/55">%</span></span>
                    <span className="mt-1.5 block text-[11px] uppercase tracking-[0.18em] text-ink/50">{g.done ? 'Reached' : 'Complete'}</span></span>
                )
              ) : <Icon name="goal" className="size-12 text-[#f0b45a]/70" />}
            </span>
          </div>

          <div className="min-w-0">
            <p id="ev-ult" className={`${eyebrow} text-[#f0b45a]`}>Ultimate goal</p>
            {g ? (
              ambition ? (
              <>
                <h2 className="mt-2 break-words text-3xl font-semibold leading-tight sm:text-4xl">{g.goal.title}</h2>
                {g.goal.why && <p className="mt-2 max-w-xl text-sm italic leading-relaxed text-ink/60">“{g.goal.why}”</p>}
                {g.measurable && (
                  <>
                    <p className="mt-5 tabular-nums"><span className="text-3xl font-medium">{g.steps.done}</span><span className="text-ink/55"> of {g.steps.total} steps</span></p>
                    <div className="relative mt-3 h-2 rounded-full bg-white/10">
                      <div className="hb-w h-full rounded-full" style={{ width: ready ? `${pct}%` : '0%', background: 'linear-gradient(90deg,#f0b45a,#64e8d3)' }} />
                    </div>
                  </>
                )}
                <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
                  <div><dt className="text-[11px] text-ink/50">On this goal</dt><dd className="tabular-nums">{plural(days, 'day')}</dd></div>
                  {g.goal.deadline && <div><dt className="text-[11px] text-ink/50">Target date</dt><dd className="tabular-nums">{fmt(new Date(g.goal.deadline))}<span className="text-ink/50"> · {g.daysLeft !== null && g.daysLeft >= 0 ? `${plural(g.daysLeft, 'day')} left` : 'date passed'}</span></dd></div>}
                  {g.support.length > 0 && <div><dt className="text-[11px] text-ink/50">Work this week</dt><dd className="tabular-nums">{plural(g.supportWeek, 'check-in')}</dd></div>}
                  {nextStep && !g.done && <div className="min-w-0 max-w-full"><dt className="text-[11px] text-ink/50">Next step</dt><dd className="break-words">{nextStep.text}</dd></div>}
                  {g.done && <div><dt className="text-[11px] text-ink/50">Status</dt><dd>Reached</dd></div>}
                </dl>
                <div className="mt-6 flex flex-wrap gap-2">
                  <button type="button" onClick={onOpen} className="hb-pill"><Icon name="note" className="size-3.5" />Open journey</button>
                  <button type="button" onClick={onEdit} className="hb-pill"><Icon name="edit" className="size-3.5" />Edit</button>
                </div>
              </>
              ) : (
              <>
                <h2 className="mt-2 break-words text-3xl font-semibold leading-tight sm:text-4xl">{g.goal.title}</h2>
                <p className="mt-1.5 text-sm text-ink/55">{g.orphaned ? 'The habit this followed was deleted. Progress so far is kept.' : g.habit ? `Counts check-ins of ${g.habit.text}` : 'Updated by you'}</p>
                <p className="mt-5 tabular-nums"><span className="text-3xl font-medium">{num(g.current)}</span><span className="text-ink/55"> / {num(g.goal.target)}{unit}</span></p>
                <div className="relative mt-3 h-2 rounded-full bg-white/10">
                  <div className="hb-w h-full rounded-full" style={{ width: ready ? `${pct}%` : '0%', background: 'linear-gradient(90deg,#f0b45a,#64e8d3)' }} />
                  {[25, 50, 75].map(m => <span key={m} aria-hidden="true" className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors duration-700 ${pct >= m ? 'border-[#f0b45a] bg-[#f0b45a]' : 'border-white/30 bg-[#07121a]'}`} style={{ left: `${m}%` }} />)}
                </div>
                <div aria-hidden="true" className="relative mt-2 h-4 text-[11px] tabular-nums text-ink/45">
                  {[25, 50, 75, 100].map(m => <span key={m} className={`absolute ${m === 100 ? '-translate-x-full' : '-translate-x-1/2'}`} style={{ left: `${m}%` }}>{num(Math.round((g.goal.target * m) / 100))}</span>)}
                </div>
                <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
                  <div><dt className="text-[11px] text-ink/50">On this goal</dt><dd className="tabular-nums">{plural(days, 'day')}</dd></div>
                  <div><dt className="text-[11px] text-ink/50">{g.done ? 'Completed' : 'Still to go'}</dt><dd className="tabular-nums">{g.done ? 'Every step done' : `${num(left)}${unit}`}</dd></div>
                  {showEta && <div><dt className="text-[11px] text-ink/50">At this pace</dt><dd className="tabular-nums">around {fmt(eta)}</dd></div>}
                </dl>
                <div className="mt-6 flex flex-wrap gap-2">
                  {onBump && <button type="button" onClick={onBump} className="hb-pill"><Icon name="plus" className="size-3.5" />Log progress</button>}
                  <button type="button" onClick={onEdit} className="hb-pill"><Icon name="edit" className="size-3.5" />Edit</button>
                </div>
              </>
              )
            ) : (
              <>
                <h2 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">Every legend has one goal.</h2>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink/65">Pick the one big thing your habits are all building towards. It can be a number, or an ambition with no number on it, like winning a scholarship. It gets its own spotlight here so you never lose sight of it.</p>
                <button type="button" onClick={onSet} className="mt-6 rounded-lg bg-gradient-to-r from-[#f0b45a] to-[#64e8d3] px-4 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90">Set your ultimate goal</button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function AreaItem({ a, ready, onNavigate }: { a: GrowthArea; ready: boolean; onNavigate: (t: Tab) => void }) {
  return (
    <li className="flex flex-col items-center text-center lg:items-start lg:text-left">
      <Ring score={a.score} ready={ready} colors={AREA_COLORS[a.id] ?? ['#64e8d3', '#3b8cff']} />
      <p className="mt-3 text-sm font-medium">{a.label}</p>
      <p className="text-xs text-ink/55">{a.basis}</p>
      {a.score === null ? (
        <button type="button" onClick={() => onNavigate('Habits')} className="mt-1.5 text-xs text-teal/80 transition-colors hover:text-teal">
          {a.habits === 0 ? 'Add a habit' : 'Nothing scheduled lately'}
        </button>
      ) : (
        <p className="mt-1.5 text-[11px] tabular-nums text-ink/50">
          {a.delta !== null && a.delta !== 0 && <span className={`mr-1.5 ${a.delta > 0 ? 'text-mint' : 'text-red-300/80'}`}>{a.delta > 0 ? '▲' : '▼'} {Math.abs(a.delta)}</span>}
          {plural(a.total, 'check-in')} in all
        </p>
      )}
    </li>
  )
}

function GoalRow({ g, tag, onEdit, onOpen, onBump }: { g: GoalView; tag?: string; onEdit: () => void; onOpen: () => void; onBump?: () => void }) {
  const unit = g.goal.unit ? ` ${g.goal.unit}` : ''
  const ambition = g.goal.kind === 'ambition'
  const next = g.goal.milestones.find(m => !m.doneAt)
  return (
    <li className="flex items-center gap-1">
      <button type="button" onClick={ambition ? onOpen : onEdit} aria-label={`${ambition ? 'Open' : 'Edit'} goal: ${g.goal.title}`} className="min-w-0 flex-1 rounded-xl px-2.5 py-3 text-left transition-colors hover:bg-white/[0.05]">
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-[15px]">
            {g.done && <span className="grid size-4 shrink-0 place-items-center rounded-full bg-gradient-to-br from-mint to-teal text-bg"><Icon name="check" className="size-2.5" /></span>}
            <span className="truncate">{g.goal.title}</span>
            {tag && <span className="shrink-0 rounded-full border border-white/10 px-1.5 py-px text-[10px] uppercase tracking-wider text-ink/50">{tag}</span>}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-ink/60">
            {g.done ? 'Completed'
              : ambition ? (g.measurable ? <><span className="text-sm text-ink">{g.steps.done}</span> / {g.steps.total} steps</> : g.daysLeft !== null ? (g.daysLeft >= 0 ? `${plural(g.daysLeft, 'day')} left` : 'Date passed') : 'Ongoing')
              : <><span className="text-sm text-ink">{num(g.current)}</span> / {num(g.goal.target)}{unit}</>}
          </span>
        </div>
        {g.measurable && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/15">
            <div className="hb-w h-full rounded-full" style={{ width: `${g.pct}%`, background: bar(g.color) }} />
          </div>
        )}
        <p className={`${g.measurable ? 'mt-1.5' : 'mt-1'} truncate text-[11px] text-ink/45`}>
          {ambition ? (g.done ? 'Reached. Open it to read your journey.' : next ? `Next: ${next.text}` : g.support.length ? `${plural(g.supportWeek, 'check-in')} this week from its habits` : 'Open it to add steps, log notes and track the work.')
            : g.orphaned ? 'The habit this followed was deleted. Progress so far is kept.'
            : g.habit ? `Counts check-ins of ${g.habit.text}`
            : 'Updated by you'}
        </p>
      </button>
      {onBump && (
        <button type="button" onClick={onBump} aria-label={`Add one to ${g.goal.title}`} title="Add one"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-ink/55 transition-colors hover:bg-white/10 hover:text-teal">
          <Icon name="plus" className="size-4" />
        </button>
      )}
    </li>
  )
}

function AchievementRow({ a, fmt }: { a: Achievement; fmt: (d: Date) => string }) {
  return (
    <li className={`flex items-center gap-3 py-2.5 ${a.unlocked ? '' : 'opacity-60'}`}>
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${a.unlocked ? 'bg-teal/10 text-teal' : 'bg-white/[0.06] text-ink/50'}`}><Icon name={a.icon} className="size-[18px]" /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{a.title}</p>
        {a.unlocked ? <p className="truncate text-xs text-ink/55">{a.detail}</p> : (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/15"><div className="hb-w h-full rounded-full bg-white/40" style={{ width: `${(a.have / a.need) * 100}%` }} /></div>
        )}
      </div>
      <span className="shrink-0 text-xs tabular-nums text-ink/55">
        {a.unlocked ? (a.on ? fmt(a.on) : 'Earned') : `${num(a.have)} / ${num(a.need)}`}
      </span>
    </li>
  )
}

export default function Evolution({ state, onNavigate, onAddGoal, onUpdateGoal, onRemoveGoal }: Props) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(i) }, [])
  const [ready, setReady] = useState(false) // lets bars and rings grow in from empty on first paint
  useEffect(() => { const r = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(r) }, [])
  const [modal, setModal] = useState<'new' | Goal | null>(null)
  const [journeyId, setJourneyId] = useState<string | null>(null)
  const [newTerm, setNewTerm] = useState<GoalTerm>('short')
  const [achOpen, setAchOpen] = useState(false)
  const [heroModal, setHeroModal] = useState(false)
  const [bg, setBg] = useHeroBg()
  const { wall, setFile: setWallFile, clear: clearWall } = useWallpaper('evolution-hero')
  const heroRef = useRef<HTMLElement>(null)
  const frame = useRef(0)
  const nudge = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'touch' || isTouchDevice()) return
    const el = heroRef.current
    if (!el || frame.current) return
    const { clientX, clientY } = e
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const r = el.getBoundingClientRect()
      el.style.setProperty('--px', String(((clientX - r.left) / r.width - 0.5) * 2))
      el.style.setProperty('--py', String(((clientY - r.top) / r.height - 0.5) * 2))
    })
  }
  const settle = () => { heroRef.current?.style.setProperty('--px', '0'); heroRef.current?.style.setProperty('--py', '0') }
  const [showAll, setShowAll] = useState(false) // the ladder has 20 levels: by default show the one before, you, and the next few

  const ev = useMemo(() => buildEvolution(state, now), [state, now])
  const stage = STAGES[ev.stage]
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {}) })
  const habits = useMemo(() => state.tasks.filter(isHabit).sort((a, b) => a.text.localeCompare(b.text)), [state.tasks])
  const daysIn = ev.startedOn ? Math.max(1, Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(ev.startedOn).getTime()) / 86400000) + 1) : 0
  const unlocked = ev.achievements.filter(a => a.unlocked)
  const locked = ev.achievements.filter(a => !a.unlocked).sort((a, b) => b.have / b.need - a.have / a.need)
  const sortedUnlocked = [...unlocked].sort((a, b) => (b.on?.getTime() ?? 0) - (a.on?.getTime() ?? 0))
  const [lead, ...rest] = ev.insight
  const allAch = [...sortedUnlocked, ...locked]
  const openNew = (t: GoalTerm) => { setNewTerm(t); setModal('new') }
  const ultimate = ev.goals.find(g => g.goal.term === 'long') ?? null
  const rank = (t: GoalTerm) => GOAL_TERMS.findIndex(x => x.id === t)
  const others = ev.goals.filter(g => g !== ultimate).sort((a, b) => Number(a.done) - Number(b.done) || rank(a.goal.term) - rank(b.goal.term) || b.pct - a.pct)
  const bump = (g: GoalView) => (g.goal.kind === 'count' && !g.goal.habitId && !g.done ? () => onUpdateGoal(g.goal.id, { current: g.goal.current + 1 }) : undefined)
  const visible = STAGES.map((st, i) => ({ st, i })).filter(({ i }) => showAll || (i >= ev.stage - 1 && i <= ev.stage + 4))

  return (
    <div className="hb-cards">
      <TopBar name={state.name}>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Evolution</h1>
          <p className="mt-1 text-sm text-ink/60">Who you are becoming, one check-in at a time.</p>
        </div>
      </TopBar>

      {/* Where am I now? */}
      <section ref={heroRef} onPointerMove={nudge} onPointerLeave={settle} className="fade-up relative isolate overflow-hidden rounded-2xl border border-white/15 shadow-xl shadow-black/40" style={delay(1)} aria-label="Current evolution">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          {wall ? (
            wall.kind === 'video'
              ? <video src={wall.url} autoPlay muted loop playsInline className="absolute inset-0 size-full object-cover" />
              : <img src={wall.url} alt="" className="absolute inset-0 size-full object-cover" style={bg.blur ? { filter: `blur(${bg.blur}px)`, transform: 'scale(1.1)' } : undefined} />
          ) : bg.mode === 'aura' ? <LevelAura stage={ev.stage} /> : <LiveScene theme={bg.mode} />}
          <div className="absolute inset-0" style={{ backgroundColor: `rgba(3, 9, 14, ${bg.dim})` }} />
          <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/25 to-transparent" />
        </div>
        <button type="button" onClick={() => setHeroModal(true)} className="hb-pill absolute right-4 top-4 z-10"><Icon name="image" className="size-3.5" />Customize</button>
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-end lg:gap-12">
          <div>
            <div className="flex items-center gap-5 sm:gap-6">
              <PremiumRankBadge stage={ev.stage} title={stage.persona} level={ev.stage + 1} />
              <div className="min-w-0">
                <p className={`${eyebrow} text-ink/70`}>Level {ev.stage + 1} <span className="text-ink/40">of {STAGES.length}</span></p>
                <h2 className="mt-2 break-words text-2xl font-semibold uppercase tracking-[0.14em] sm:text-4xl">{stage.persona}</h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-ink/70">{stage.meaning}</p>
              </div>
            </div>

            <div className="mt-7 max-w-lg">
              <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                <span className="tabular-nums"><span className="font-medium">{num(ev.xp)}</span>{ev.next && <span className="text-ink/55"> / {num(ev.next.min)} XP</span>}{!ev.next && <span className="text-ink/55"> XP</span>}</span>
                {ev.next && <span className="text-ink/60">Next: <span className="uppercase tracking-[0.1em] text-ink">{ev.next.persona}</span></span>}
              </div>
              <div role="progressbar" aria-label={`Progress to ${ev.next?.persona ?? 'the final stage'}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={ev.progress} className="h-1.5 overflow-hidden rounded-full bg-white/15">
                <div className="ev-xp h-full rounded-full bg-gradient-to-r from-mint to-blue" style={{ width: ready ? `${ev.progress}%` : '0%' }} />
              </div>
              <p className="mt-2.5 text-xs text-ink/55">
                {ev.next ? `${num(ev.toNext)} XP to go, about ${plural(ev.checkInsToNext, 'check-in')}. Every completed check-in is worth 10 XP.` : 'The highest stage. XP keeps counting.'}
              </p>
            </div>
          </div>

          <dl className="divide-y divide-white/10 border-t border-white/10 text-sm lg:border-l lg:border-t-0 lg:pl-10">
            <div className="flex items-center justify-between gap-4 py-3 lg:pt-0">
              <dt className="text-ink/60">Current streak</dt>
              <dd className="flex items-center gap-1.5 text-lg tabular-nums"><Icon name="flame" className={`size-4 text-orange-400 ${ev.streak > 0 ? 'flame' : 'opacity-50'}`} />{ev.streak > 0 ? plural(ev.streak, 'day') : 'None yet'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-ink/60">Check-ins</dt>
              <dd className="text-lg tabular-nums">{num(ev.totalCheckIns)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3 lg:pb-0">
              <dt className="text-ink/60">On the journey</dt>
              <dd className="text-right text-lg tabular-nums">{ev.startedOn ? <>{plural(daysIn, 'day')}<span className="block text-xs text-ink/50">since {fmt(new Date(ev.startedOn))}</span></> : 'Not started'}</dd>
            </div>
          </dl>
        </div>
        {state.tasks.length === 0 && (
          <div className="border-t border-white/10 px-6 py-3.5 text-sm text-ink/70 sm:px-8">
            Your evolution starts with your first habit. <button type="button" onClick={() => onNavigate('Habits')} className="text-teal transition-colors hover:underline">Add one</button>
          </div>
        )}
      </section>

      {/* How far have I come? */}
      <section className="fade-up mt-12" style={delay(2)} aria-labelledby="ev-journey">
        <div className="mb-6 flex items-baseline justify-between gap-3">
          <h2 id="ev-journey" className={`${eyebrow} text-ink/70`}>Your journey</h2>
          <p className="text-xs text-ink/60">{ev.startedOn ? `Started ${fmt(new Date(ev.startedOn))}` : 'It begins with your first habit'}</p>
        </div>
        <ol className="grid gap-7">
          {visible.map(({ st, i }, idx) => {
            const mode = i < ev.stage ? 'done' : i === ev.stage ? 'here' : 'ahead'
            const fill = i < ev.stage ? 100 : i === ev.stage ? ev.progress : 0
            const when = ev.reached[i]
            return (
              <li key={st.id} aria-current={mode === 'here' ? 'step' : undefined} className="relative flex gap-4">
                {idx < visible.length - 1 && <span aria-hidden="true" className="ev-link"><i style={{ '--f': ready ? `${fill}%` : '0%' } as CSSProperties} /></span>}
                <span className="relative z-10 size-14 shrink-0">
                  <Badge i={i} locked={mode === 'ahead'} glow={mode === 'here'} className="size-14" />
                  {mode === 'done' && <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-gradient-to-br from-mint to-teal text-bg ring-2 ring-[#0a141b]"><Icon name="check" className="size-3" /></span>}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-ink/40">Level {i + 1}</p>
                  <p className={`text-sm ${mode === 'here' ? 'font-semibold uppercase tracking-[0.12em] text-ink' : mode === 'done' ? 'text-ink/90' : 'text-ink/50'}`}>{st.title}</p>
                  <p className="mt-0.5 text-xs text-ink/45">{st.meaning}</p>
                  <p className="mt-1 text-xs tabular-nums text-ink/50">
                    {mode === 'here' ? <span className="text-teal">You are here</span> : mode === 'done' ? (when ? `Reached ${fmt(when)}` : 'Reached') : `${num(st.min)} XP`}
                  </p>
                  {mode !== 'ahead' && <p className="text-[11px] tabular-nums text-ink/40">{i === 0 ? 'Where you started' : `${num(st.min)} XP`}</p>}
                </div>
              </li>
            )
          })}
        </ol>
        <button type="button" onClick={() => setShowAll(v => !v)} className="mt-6 text-sm text-teal transition-colors hover:underline">
          {showAll ? 'Show fewer levels' : `Show all ${STAGES.length} levels`}
        </button>

        <div className="mt-8 grid gap-1 border-t border-white/10 pt-5 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-8">
          <p className={`${eyebrow} text-ink/60`}>{ev.next ? `To become ${ev.next.persona}` : 'At the summit'}</p>
          <div className="text-sm leading-relaxed text-ink/75">
            {ev.next ? (
              <>
                <p>{ev.next.meaning}</p>
                <p className="mt-1.5">
                  Earn {num(ev.toNext)} more XP, which is {plural(ev.checkInsToNext, 'check-in')}.{' '}
                  {ev.daysToNext !== null ? `At your recent pace of about ${ev.pace.toFixed(1)} a day, that is roughly ${plural(ev.daysToNext, 'day')}.` : 'Check in today and an estimate will appear here.'}
                </p>
              </>
            ) : <p>You have reached the final stage. Nothing is left to unlock, only to keep up.</p>}
          </div>
        </div>
      </section>

      {/* Growth areas and what they say */}
      <section className="fade-up mt-12" style={delay(3)} aria-labelledby="ev-areas">
        <div className="mb-6 flex items-baseline justify-between gap-3">
          <h2 id="ev-areas" className={`${eyebrow} text-ink/70`}>Growth areas</h2>
          <p className="text-xs text-ink/60">Share of check-ins completed, last 30 days</p>
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {ev.areas.map(a => <AreaItem key={a.id} a={a} ready={ready} onNavigate={onNavigate} />)}
        </ul>

        <div className="glass mt-8 rounded-2xl p-5 sm:p-6">
          <h3 className={`${eyebrow} mb-3 text-ink/70`}>What this says</h3>
          <p className="text-[17px] font-medium leading-snug">{lead}</p>
          {rest.length > 0 && <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-ink/70">{rest.map((l, i) => <p key={i}>{l}</p>)}</div>}
        </div>
      </section>

      {/* Where am I going? */}
      <UltimateCard g={ultimate} now={now} ready={ready} fmt={fmt} onSet={() => openNew('long')} onEdit={() => ultimate && setModal(ultimate.goal)} onBump={ultimate ? bump(ultimate) : undefined} onOpen={() => ultimate && setJourneyId(ultimate.goal.id)} />

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section className="glass fade-up rounded-2xl p-5 sm:p-6" style={delay(4)} aria-labelledby="ev-goals">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="ev-goals" className={`${eyebrow} text-ink/70`}>Your goals</h2>
            <button type="button" onClick={() => openNew('short')} className="hb-pill"><Icon name="plus" className="size-3.5" />Add goal</button>
          </div>
          {others.length === 0 ? (
            <div className="py-2">
              <p className="text-sm leading-relaxed text-ink/70">Short term and mid term goals live here. A goal can be a number (60 workouts, 12 books) or an ambition with no number, like winning a scholarship, tracked through steps, the habits that feed it and your own notes.</p>
              <button type="button" onClick={() => openNew('short')} className="mt-4 rounded-lg border border-white/10 px-3.5 py-2 text-sm transition-colors hover:border-teal/40 hover:text-teal">Set your first goal</button>
            </div>
          ) : (
            <ul className="-mx-2.5 divide-y divide-white/10">
              {others.map(g => <GoalRow key={g.goal.id} g={g} tag={GOAL_TERMS[rank(g.goal.term)]?.label} onEdit={() => setModal(g.goal)} onOpen={() => setJourneyId(g.goal.id)} onBump={bump(g)} />)}
            </ul>
          )}
        </section>

        <section className="glass fade-up rounded-2xl p-5 sm:p-6" style={delay(5)} aria-labelledby="ev-ach">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 id="ev-ach" className={`${eyebrow} text-ink/70`}>Achievements</h2>
            <span className="text-xs tabular-nums text-ink/60">{unlocked.length} of {ev.achievements.length}</span>
          </div>
          <dl className="mb-3 grid grid-cols-2 gap-4 border-b border-white/10 pb-4">
            <div><dt className="text-[11px] text-ink/50">Longest streak</dt><dd className="mt-0.5 text-lg tabular-nums">{plural(ev.records.longestStreak, 'day')}</dd></div>
            <div><dt className="text-[11px] text-ink/50">Best week</dt><dd className="mt-0.5 text-lg tabular-nums">{plural(ev.records.bestWeek, 'check-in')}{ev.records.bestWeekOf && <span className="block text-[11px] text-ink/45">week of {fmt(ev.records.bestWeekOf)}</span>}</dd></div>
          </dl>
          <ul className="divide-y divide-white/[0.06]">
            {allAch.slice(0, ACH_PREVIEW).map(a => <AchievementRow key={a.id} a={a} fmt={fmt} />)}
          </ul>
          {allAch.length > ACH_PREVIEW && (
            <>
              <Collapse open={achOpen} id="ev-ach-more">
                <ul className={`divide-y divide-white/[0.06] border-t border-white/[0.06] transition-opacity duration-500 ${achOpen ? 'opacity-100' : 'opacity-0'}`}>
                  {allAch.slice(ACH_PREVIEW).map(a => <AchievementRow key={a.id} a={a} fmt={fmt} />)}
                </ul>
              </Collapse>
              <button type="button" onClick={() => setAchOpen(v => !v)} aria-expanded={achOpen} aria-controls="ev-ach-more"
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm text-teal/90 transition-colors hover:bg-white/[0.05] hover:text-teal">
                {achOpen ? 'Show less' : `Show all ${allAch.length}`}
                <svg viewBox="0 0 20 20" className={`size-4 transition-transform duration-500 ${achOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 8 5 5 5-5" /></svg>
              </button>
            </>
          )}
        </section>
      </div>

      {journeyId && (() => {
        const jg = ev.goals.find(x => x.goal.id === journeyId)
        return jg ? <GoalJourneyModal g={jg} now={now} fmt={fmt} onUpdate={f => onUpdateGoal(jg.goal.id, f)} onEdit={() => { setJourneyId(null); setModal(jg.goal) }} onClose={() => setJourneyId(null)} /> : null
      })()}
      {heroModal && <HeroBackdropModal bg={bg} stage={ev.stage} custom={wall?.kind ?? null} onChange={setBg} onFile={setWallFile} onClear={clearWall} onClose={() => setHeroModal(false)} />}
      {modal && (
        <GoalModal
          initial={modal === 'new' ? undefined : modal}
          initialTerm={newTerm}
          hasUltimate={!!ultimate}
          habits={habits}
          onSubmit={f => (modal === 'new' ? onAddGoal(f) : onUpdateGoal(modal.id, f))}
          onDelete={modal === 'new' ? undefined : () => onRemoveGoal(modal.id)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
