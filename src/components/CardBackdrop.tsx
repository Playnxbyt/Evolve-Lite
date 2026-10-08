import type { HabitsLook } from '../lib/habitsLook'
import type { Wallpaper } from '../lib/wallpaper'
import LiveScene from './LiveScene'

/**
 * Picture inside a glass card. Sits behind the card's content and inside its stacking context
 * (`.glass` creates one), so the card's frosting and rim still render on top of it.
 */
export default function CardBackdrop({ look, media }: { look: HabitsLook; media: Wallpaper | null }) {
  const photo = look.cardSrc === 'photo' && media?.kind === 'image' ? media : null
  if (look.cardSrc === 'glass' || (look.cardSrc === 'photo' && !photo)) return null
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" style={{ borderRadius: 'inherit' }}>
      <div className="absolute" style={{ inset: '-6%', filter: look.cardBlur ? `blur(${look.cardBlur}px)` : undefined }}>
        {photo ? <img src={photo.url} alt="" className="size-full object-cover" /> : <LiveScene theme={look.cardTheme} lite />}
      </div>
      <div className="absolute inset-0" style={{ backgroundColor: `rgba(3, 9, 14, ${look.cardDim})` }} />
    </div>
  )
}
