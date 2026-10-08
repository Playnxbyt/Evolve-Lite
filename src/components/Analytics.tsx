import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppState } from '../lib/core'
import { buildAnalytics, pct, type CoachKind, type MonthMix, type RangeId } from '../lib/analyticsStats'
import { catById } from '../lib/core'
import { Icon } from './Icons'
import RadarChart from './RadarChart'
import RangeTabs from './RangeTabs'
import TopBar from './TopBar'
import TrendChart from './TrendChart'
import type { Tab } from './Sidebar'

interface Props {
  state: AppState
  onNavigate: (t: Tab) => void
}

const DONUT_R = 42
const DONUT_C = 2 * Math.PI * DONUT_R
const eyebrow = 'text-[11px] font-medium uppercase tracking-[0.18em]'
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
const delay = (n: number) => ({ animationDelay: `${n * 90}ms` })
const shortDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const KIND_LABEL = { day: 'Daily completion', week: 'Weekly completion', month: 'Monthly completion' } as const
const UNIT = { day: 'day', week: 'week', month: 'month' } as const
const SLOW = 'cubic-bezier(0.22, 1, 0.36, 1)'
/** Whole-number percent, but never a misleading 0% once something has been done. */
const share = (done: number, possible: number) => (!possible ? '0' : done > 0 && done / possible < 0.005 ? '<1' : String(Math.round((done / possible) * 100)))
const COACH: Record<CoachKind, { chip: string; label: string }> = {
  win: { chip: 'bg-teal/10 text-teal', label: 'Keep going' },
  fix: { chip: 'bg-[#ff8a7a]/10 text-[#ff8a7a]', label: 'Focus here' },
  tip: { chip: 'bg-lifestyle/10 text-lifestyle', label: 'Try this' },
}

/** A single light sweep across a card whose data has just changed. */
function Sweep({ run, delayMs }: { run: number; delayMs: number }) {
  if (run === 0) return null
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <span key={run} className="an-sweep" style={{ animationDelay: `${delayMs}ms` }} />
    </span>
  )
}

function Stat({ label, children, sub }: { label: string; children: ReactNode; sub?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-ink/55">{label}</dt>
      <dd className="mt-1 text-3xl font-light tabular-nums tracking-tight">{children}</dd>
      {sub && <dd className="mt-0.5 text-[11px] leading-snug text-ink/50">{sub}</dd>}
    </div>
  )
}

/**
 * The month as one ring. The whole circle is everything scheduled this month: coloured arcs (one per area)
 * are what you completed, the red arc is what has already passed without being done, and the rest is still ahead.
 */
function MonthDonut({ month, ready }: { month: MonthMix; ready: boolean }) {
  const { total, due } = month
  const missed = due - total.done
  let at = 0
  const arcs = month.cats.filter(c => c.done > 0).map(c => {
    const len = (c.done / total.possible) * DONUT_C
    const arc = { c, from: at, len }
    at += len
    return arc
  })
  const missedLen = total.possible ? (missed / total.possible) * DONUT_C : 0
  return (
    <div className="relative size-48 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img"
        aria-label={`${total.done} of ${total.possible} scheduled check-ins done this month, ${missed} missed so far, ${total.possible - due} still ahead`}>
        <circle cx="50" cy="50" r={DONUT_R} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="11" />
        <circle cx="50" cy="50" r={DONUT_R} fill="none" stroke="rgba(255,138,122,0.5)" strokeWidth="11"
          strokeDasharray={`${ready ? Math.max(missedLen - (missedLen > 6 ? 1.5 : 0), 0) : 0} ${DONUT_C}`} strokeDashoffset={-at}
          style={{ transition: `stroke-dasharray 1.1s ${SLOW}` }}>
          <title>{`${missed} scheduled check-ins already passed without being done`}</title>
        </circle>
        {arcs.map(({ c, from, len }) => (
          <circle key={c.cat.id} cx="50" cy="50" r={DONUT_R} fill="none" stroke={c.cat.color} strokeWidth="11"
            strokeDasharray={`${ready ? Math.max(len - (len > 6 ? 1.5 : 0), 0.8) : 0} ${DONUT_C}`} strokeDashoffset={-from}
            style={{ transition: `stroke-dasharray 1.1s ${SLOW}`, filter: `drop-shadow(0 0 3px ${c.cat.color}66)` }}>
            <title>{`${c.cat.label}: ${c.done} done of ${c.possible} scheduled this month`}</title>
          </circle>
        ))}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="text-4xl font-light tabular-nums">{share(total.done, total.possible)}<span className="text-lg text-ink/50">%</span></span>
        <span className="text-[11px] text-ink/60">of the month</span>
        <span className="mt-0.5 text-[11px] tabular-nums text-ink/45">{total.done} of {total.possible}</span>
      </div>
    </div>
  )
}

export default function Analytics({ state, onNavigate }: Props) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(i) }, [])
  const [ready, setReady] = useState(false) // lets rings and bars grow in from empty on first paint
  useEffect(() => { const r = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(r) }, [])
  const [range, setRange] = useState<RangeId>('30')
  const [run, setRun] = useState(0) // bumps on every range change so the animations replay
  const pick = (id: RangeId) => { if (id !== range) { setRange(id); setRun(r => r + 1) } }

  const a = useMemo(() => buildAnalytics(state, range, now), [state, range, now])
  const { month, coach } = a
  const byMonth = [...month.cats].sort((x, y) => y.done / y.possible - x.done / x.possible || y.possible - x.possible)
  const known = a.radar.filter(r => r.known).sort((x, y) => y.value - x.value)
  const strong = known[0], weak = known[known.length - 1]
  const spread = known.length > 1 && strong.value !== weak.value
  const tracked = a.buckets.filter(b => b.possible > 0)
  const bestBucket = tracked.reduce<(typeof tracked)[number] | null>((m, b) => (!m || pct(b) > pct(m) ? b : m), null)
  const latest = tracked[tracked.length - 1]

  return (
    <div className="hb-cards">
      <TopBar name={state.name}>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-ink/60">Understand your progress and see what to improve next.</p>
        </div>
      </TopBar>

      <div className="fade-up flex flex-wrap items-center justify-between gap-3">
        <RangeTabs value={range} onChange={pick} />
        <p key={run} className="an-rise text-xs tabular-nums text-ink/60">Trend and coaching: {shortDate(a.start)} – {shortDate(a.end)} · {plural(a.days, 'day')}</p>
      </div>

      {!a.hasTasks ? (
        <section className="glass fade-up mt-6 rounded-2xl p-6" style={delay(1)}>
          <p className="text-sm text-ink/70">Nothing to analyse yet. Add a habit and check it off, and your progress will show up here.</p>
          <button type="button" onClick={() => onNavigate('Habits')} className="mt-4 rounded-lg border border-white/10 px-3.5 py-2 text-sm transition-colors hover:border-teal/40 hover:text-teal">Go to Habits</button>
        </section>
      ) : (
        <>
          <section className="glass fade-up mt-6 rounded-2xl p-5 sm:p-6" style={delay(1)}>
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className={`${eyebrow} text-ink/70`}>This month</h2>
              <span className="text-xs tabular-nums text-ink/60">{month.label} · day {month.elapsed} of {month.days}</span>
            </div>
            {byMonth.length === 0 ? (
              <p className="text-sm text-ink/60">Nothing is scheduled this month yet.</p>
            ) : (
              <>
                <div className="grid gap-8 md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-12">
                  <div className="flex flex-col items-center gap-3">
                    <MonthDonut month={month} ready={ready} />
                    <p className="flex items-center gap-3 text-[11px] text-ink/55">
                      <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-teal" />Done</span>
                      <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#ff8a7a]/60" />Missed</span>
                      <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-white/20" />Still ahead</span>
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="mb-3 text-sm text-ink/65">Done out of everything scheduled, by area</p>
                    <ul className="space-y-3.5">
                      {byMonth.map(c => (
                        <li key={c.cat.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3">
                          <span className="grid size-9 place-items-center rounded-lg" style={{ backgroundColor: `${c.cat.color}1F`, color: c.cat.color }}><Icon name={c.cat.icon} className="size-[18px]" /></span>
                          <div className="min-w-0">
                            <p className="truncate text-sm">{c.cat.label}</p>
                            <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                              <div className="absolute inset-y-0 rounded-full bg-[#ff8a7a]/50" style={{ left: `${(c.done / c.possible) * 100}%`, width: ready ? `${((c.due - c.done) / c.possible) * 100}%` : '0%', transition: `width 1s ${SLOW}` }} />
                              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: ready ? `${c.done ? Math.max((c.done / c.possible) * 100, 2) : 0}%` : '0%', backgroundColor: c.cat.color, boxShadow: `0 0 8px ${c.cat.color}88`, transition: `width 1.1s ${SLOW}` }} />
                            </div>
                            <p className="mt-1 text-[11px] tabular-nums text-ink/50">{c.done} of {c.possible} done · {c.due - c.done} missed so far</p>
                          </div>
                          <span className="text-right tabular-nums"><span className="text-lg font-light">{share(c.done, c.possible)}%</span><span className="block text-[10px] text-ink/45">of month</span></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-white/10 pt-5 sm:grid-cols-4">
                  <Stat label="Scheduled" sub="every check-in this month">{month.total.possible}</Stat>
                  <Stat label="Completed" sub={`${share(month.total.done, month.total.possible)}% of the month`}>{month.total.done}</Stat>
                  <Stat label="Missed so far" sub="scheduled days that passed, not done"><span className="text-[#ff8a7a]">{month.due - month.total.done}</span></Stat>
                  <Stat label="Still ahead" sub="left today and the days to come">{month.total.possible - month.due}</Stat>
                </dl>
                <p className="mt-4 text-[11px] leading-relaxed text-ink/45">
                  Scheduled = Completed + Missed + Still ahead. Today only counts as missed once the day is over. A habit counts only on the days it repeats (a Monday and Tuesday habit adds one on each Monday and Tuesday), starting from the day you created it. {plural(month.perfectDays, 'perfect day')} so far.
                </p>
              </>
            )}
          </section>

          <section className="glass fade-up mt-6 rounded-2xl p-5 sm:p-6" style={delay(2)}>
            <Sweep run={run} delayMs={0} />
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className={`${eyebrow} text-ink/70`}>Completion trend</h2>
              <span className="text-xs text-ink/60">Share of scheduled check-ins completed</span>
            </div>
            <TrendChart buckets={a.buckets} kindLabel={KIND_LABEL[a.bucketKind]} replay={run} />
            {tracked.length >= 2 && bestBucket && latest && (
              <dl key={run} className="an-rise mt-5 grid grid-cols-3 gap-4 border-t border-white/10 pt-4" style={{ animationDelay: '0.4s' }}>
                <div><dt className="text-[11px] text-ink/55">So far</dt><dd className="mt-0.5 text-xl font-light tabular-nums">{pct(a.total)}%</dd><dd className="text-[11px] tabular-nums text-ink/50">{a.total.done} of {a.total.possible} that came up</dd></div>
                <div><dt className="text-[11px] text-ink/55">Best {UNIT[a.bucketKind]}</dt><dd className="mt-0.5 text-xl font-light tabular-nums">{pct(bestBucket)}%</dd><dd className="truncate text-[11px] text-ink/50">{bestBucket.label}</dd></div>
                <div><dt className="text-[11px] text-ink/55">Latest</dt><dd className="mt-0.5 text-xl font-light tabular-nums">{pct(latest)}%</dd><dd className="truncate text-[11px] text-ink/50">{latest.label}{latest.partial ? ' · in progress' : ''}</dd></div>
              </dl>
            )}
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <section className="glass fade-up flex flex-col rounded-2xl p-5 sm:p-6" style={delay(3)}>
              <Sweep run={run} delayMs={120} />
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <h2 className={`${eyebrow} text-ink/70`}>Your stats</h2>
                <span className="text-xs text-ink/60">Score out of 100</span>
              </div>
              <p className="text-xs text-ink/55">Done out of everything scheduled this month, by area ({month.label}).</p>
              <RadarChart axes={a.radar} />
              <div key={run} className="an-rise mt-auto border-t border-white/10 pt-4" style={{ animationDelay: '0.3s' }}>
                {known.length === 0 ? (
                  <p className="text-sm text-ink/60">Check off a few tasks and your strong and weak areas will show up here.</p>
                ) : spread ? (
                  <div className="grid grid-cols-2 gap-4">
                    {([['Strongest area', strong, 'text-teal'], ['Needs attention', weak, 'text-[#ff8a7a]']] as const).map(([label, r, tone]) => {
                      const cat = catById(r.id)
                      return (
                        <div key={label} className="flex items-start gap-2.5">
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${cat.color}1F`, color: cat.color }}><Icon name={cat.icon} className="size-4" /></span>
                          <div className="min-w-0">
                            <dt className={`text-[11px] ${tone}`}>{label}</dt>
                            <dd className="truncate text-sm">{r.label} <span className="tabular-nums text-ink/60">{r.value}</span></dd>
                            <dd className="text-[11px] tabular-nums text-ink/50">{r.done} of {r.possible} done this month</dd>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-ink/70">{known.length === 1 ? `Only ${strong.label} has tasks scheduled this month so far (${strong.value}).` : `You're evenly balanced across your areas at ${strong.value}.`}</p>
                )}
              </div>
            </section>

            <section className="glass fade-up flex flex-col rounded-2xl p-5 sm:p-6" style={delay(4)}>
              <Sweep run={run} delayMs={240} />
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 className={`${eyebrow} text-ink/70`}>Insights</h2>
                <span className="text-xs text-ink/60">Your coach&rsquo;s take</span>
              </div>
              <div key={run} className="flex flex-1 flex-col">
                <div className="flex gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal/25 to-blue/20 text-teal"><Icon name="bulb" className="size-5" /></span>
                  <p className="an-rise text-lg font-medium leading-snug sm:text-xl" style={{ animationDelay: '0.2s' }}>{coach.lead}</p>
                </div>
                <p className="mb-3 mt-6 text-[11px] font-medium uppercase tracking-[0.18em] text-ink/45">Your next steps</p>
                <ul className="space-y-3">
                  {coach.steps.map((st, i) => (
                    <li key={st.title} className="an-rise flex gap-3.5 rounded-xl border border-white/10 bg-white/[0.04] p-4" style={{ animationDelay: `${0.4 + i * 0.14}s` }}>
                      <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${COACH[st.kind].chip}`}><Icon name={st.icon} className="size-[18px]" /></span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink/45">{COACH[st.kind].label}</p>
                        <p className="font-medium">{st.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-ink/70">{st.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
