import type { CSSProperties } from 'react'

const PATHS = {
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  habits: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M8 12l3 3 5-6',
  analytics: 'M5 20V11 M12 20V4 M19 20v-6',
  calendar: 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4',
  evolution: 'M12 21V11 M12 11c0-4 3-6 7-6 0 4-3 6-7 6z M12 15c0-3-2-5-6-5 0 3 2 5 6 5z',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 4-6 8-6s8 2 8 6',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z M10 21h4',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z',
  plus: 'M12 5v14 M5 12h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M21 21l-4.3-4.3',
  play: 'M8 5l11 7-11 7z',
  note: 'M5 4h14v16H5z M9 9h6 M9 13h4',
  bulb: 'M9 18h6 M10 21h4 M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
  check: 'M5 12l5 5 9-10',
  chevron: 'M9 6l6 6-6 6',
  close: 'M6 6l12 12 M18 6L6 18',
  image: 'M4 5h16v14H4z M4 16l5-5 4 4 3-3 4 4 M9 9h.01',
  dumbbell: 'M6 7v10 M3 9.5v5 M18 7v10 M21 9.5v5 M6 12h12',
  brain: 'M12 4a4 4 0 0 0-4 4 4 4 0 0 0-2 7 4 4 0 0 0 2 7h4z M12 4a4 4 0 0 1 4 4 4 4 0 0 1 2 7 4 4 0 0 1-2 7h-4z M12 4v18',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 19a2 2 0 0 1 2-2h13 M8 7h7',
  briefcase: 'M4 8h16v11H4z M9 8V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3 M4 13h16',
  leaf: 'M6 18C6 9 12 4 20 4c0 8-5 14-14 14z M6 18c3-5 7-8 11-10',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 3',
  edit: 'M4 20h4L19 9a2 2 0 0 0-4-4L4 16z M13 7l4 4',
  goal: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 12h.01',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, className = 'size-5', style }: { name: IconName; className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}