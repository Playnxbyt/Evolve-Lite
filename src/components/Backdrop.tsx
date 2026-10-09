import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Wallpaper } from '../lib/wallpaper'
import LiveScene from './LiveScene'
import { isTouchDevice } from '../lib/device'

/** The wallpaper video. On phones it prefers a small `-mobile.mp4` next to the original if one exists (same picture, fewer pixels to decode). */
function WallVideo({ url, style }: { url: string; style: CSSProperties }) {
  const ref = useRef<HTMLVideoElement>(null)
  const small = isTouchDevice() && /\.mp4$/.test(url) && !url.startsWith('blob:') ? url.replace(/\.mp4$/, '-mobile.mp4') : null
  const [src, setSrc] = useState(small ?? url)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    // Keep wallpaper playback uninterrupted during scrolling. Pause only while the
    // tab is hidden, then resume when it becomes visible again.
    const sync = () => {
      if (document.hidden) v.pause()
      else v.play().catch(() => { /* autoplay may need a gesture */ })
    }
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])
  return (
    <video ref={ref} key={src} src={src} autoPlay muted loop playsInline preload={document.documentElement.dataset.visuals === 'minimal' ? 'metadata' : 'auto'} disablePictureInPicture disableRemotePlayback
      className="wall-blur" style={style} onError={() => { if (src !== url) setSrc(url) }} />
  )
}

interface Props {
  /** `ambient` for the fixed page backdrop, `ambient-sm` for a preview box. */
  className: string
  media: Wallpaper | null
  /** A live-scene theme id, used when there is no media. */
  scene?: string | null
  blur: number
  /** Darkness laid over the picture, 0 (none) to 1. */
  dim: number
}

/** The picture (or live scene, or soft ambient light) behind a page, blurred and dimmed. */
export default function Backdrop({ className, media, scene, blur, dim }: Props) {
  // The soft look (saturation up, slightly darker, picture overscanned so blurred edges never show) fades out as the blur goes to 0.
  const k = Math.min(blur / 20, 1)
  const over = Math.min(8, blur / 5)
  // Keep the user's blur effect in Minimal mode, but cap the expensive full-screen
  // blur on phones so moving wallpapers remain smoother while scrolling.
  const minimal = typeof document !== 'undefined' && document.documentElement.dataset.visuals === 'minimal'
  const effectiveBlur = minimal ? Math.min(blur, 6) : blur
  const filter = effectiveBlur > 0 ? `blur(${effectiveBlur}px) saturate(${1 + 0.3 * k}) brightness(${1 - 0.15 * k})` : 'none'
  // Keep the enlarged wallpaper centered as blur changes. Expanding via inset + width/height
  // can trigger positioning/rounding differences in browsers, making the image drift sideways.
  const fit = {
    inset: 'auto',
    left: '50%',
    top: '50%',
    width: `${100 + 2 * over}%`,
    height: `${100 + 2 * over}%`,
    transform: 'translate3d(-50%, -50%, 0)',
    backfaceVisibility: 'hidden' as const,
    WebkitBackfaceVisibility: 'hidden' as const,
  }
  const style = { filter, ...fit }
  const shade = <div className="absolute inset-0" style={{ backgroundColor: `rgba(3, 9, 14, ${dim})` }} />
  return (
    <div aria-hidden="true" className={className}>
      {media ? (
        <>
          {media.kind === 'video'
            ? <WallVideo key={media.url} url={media.url} style={style} />
            : <img key={media.url} src={media.url} alt="" className="wall-blur" style={style} />}
          {shade}
        </>
      ) : scene ? (
        <>
          <div className="absolute" style={{ inset: '-6%', filter: blur ? `blur(${blur}px)` : undefined }}><LiveScene theme={scene} track={className === 'ambient'} /></div>
          {shade}
        </>
      ) : (
        <><i /><i /><i /></>
      )}
    </div>
  )
}
