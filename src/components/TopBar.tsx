import type { ReactNode } from 'react'
import { BellMenu, ProfileMenu } from './HeaderMenus'

export default function TopBar({ name, meta, children }: { name: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <header className="mb-7 flex items-start justify-between gap-4">
      <div>{children}</div>
      <div className="flex items-center gap-1.5">
        {meta && <span className="mr-2 hidden text-xs text-muted sm:block">{meta}</span>}
        <BellMenu />
        <ProfileMenu name={name} />
      </div>
    </header>
  )
}
