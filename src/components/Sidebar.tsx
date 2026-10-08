import { Icon, type IconName } from './Icons'
import MountainScene from './MountainScene'

export const NAV: { id: string; icon: IconName }[] = [
  { id: 'Home', icon: 'home' },
  { id: 'Habits', icon: 'habits' },
  { id: 'Analytics', icon: 'analytics' },
  { id: 'Calendar', icon: 'calendar' },
  { id: 'Spaces', icon: 'note' },
  { id: 'Evolution', icon: 'evolution' },
  { id: 'Profile', icon: 'profile' },
]

export type Tab = 'Home' | 'Habits' | 'Analytics' | 'Calendar' | 'Spaces' | 'Evolution' | 'Profile'

interface Props {
  tab: Tab
  onChange: (t: Tab) => void
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ tab, onChange, collapsed, onToggle }: Props) {
  return (
    <>
      <aside
        data-collapsed={collapsed}
        className="sb glass fixed bottom-3 left-3 top-3 z-20 hidden flex-col overflow-hidden rounded-3xl px-4 py-6 lg:flex"
      >
        <MountainScene className="sb-scene pointer-events-none absolute inset-x-0 bottom-0 h-64 w-full [mask-image:linear-gradient(to_top,black_45%,transparent)]" />

        <div className="relative z-10 mb-8 flex h-10 items-center">
          <span className="sb-ico">
            <img src={`${import.meta.env.BASE_URL}logo-mark.png`} alt="" aria-hidden="true" className="size-7 object-contain" />
          </span>
          <span className="sb-label text-[13px] font-semibold tracking-[0.4em]" style={{ ['--i' as string]: 0 }}>EVOLVE</span>
        </div>

        <nav aria-label="Primary" className="relative z-10 space-y-1" style={{ ['--idx' as string]: Math.max(0, NAV.findIndex(n => n.id === tab)) }}>
          <span aria-hidden="true" className="sb-pill" />
          {NAV.map((n, i) => (
            <button
              key={n.id}
              onClick={() => onChange(n.id as Tab)}
              aria-current={tab === n.id ? 'page' : undefined}
              aria-label={n.id}
              title={collapsed ? n.id : undefined}
              className="sb-item"
            >
              <span className="sb-ico">
                <Icon name={n.icon} className={`size-[18px] transition-colors duration-300 ${tab === n.id ? 'text-teal' : ''}`} />
              </span>
              <span className="sb-label" style={{ ['--i' as string]: i + 1 }}>{n.id}</span>
            </button>
          ))}
        </nav>

        <div className="relative z-10 mt-auto">
          <p className="sb-tag mb-5 px-2 text-xs leading-relaxed text-ink/70" style={{ ['--i' as string]: 7 }}>
            Small steps<br />every day create<br />extraordinary results.
          </p>
          <button
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : undefined}
            className="sb-item"
          >
            <span className="sb-ico"><Icon name="chevron" className="sb-chev size-[18px]" /></span>
            <span className="sb-label" style={{ ['--i' as string]: 8 }}>Collapse</span>
          </button>
        </div>
      </aside>

      <nav aria-label="Primary" className="glass fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 grid grid-cols-7 rounded-2xl lg:hidden">
        {NAV.map(n => (
          <button
            key={n.id}
            onClick={() => onChange(n.id as Tab)}
            aria-current={tab === n.id ? 'page' : undefined}
            className={`mnav-item flex flex-col items-center gap-1 py-2.5 text-[10px] ${tab === n.id ? 'text-teal' : 'text-muted'}`}
          >
            <Icon name={n.icon} className="size-5" />
            {n.id}
          </button>
        ))}
      </nav>
    </>
  )
}
