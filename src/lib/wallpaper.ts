import { useCallback, useEffect, useRef, useState } from 'react'

const DB = 'evolve-media', STORE = 'kv', KEY = 'wallpaper'
const SETTINGS_KEY = 'evolveScene'
const MAX_VIDEO = 40 * 1024 * 1024
const MAX_GIF = 15 * 1024 * 1024

// Wallpapers can be large (videos), so they live in IndexedDB instead of localStorage.
const open = () =>
  new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((res, rej) => {
      const tx = db.transaction(STORE, mode)
      const req = fn(tx.objectStore(STORE))
      tx.oncomplete = () => res(req.result)
      tx.onerror = tx.onabort = () => rej(tx.error)
    })
  } finally {
    db.close()
  }
}

const saveWallpaper = (b: Blob, key: string) => run('readwrite', s => s.put(b, key))
const loadWallpaper = (key: string) => run<Blob | undefined>('readonly', s => s.get(key))
const clearWallpaper = (key: string) => run('readwrite', s => s.delete(key))

async function prepare(file: File, allowVideo: boolean): Promise<Blob> {
  if (file.type.startsWith('video/')) {
    if (!allowVideo) throw new Error('Videos only work for the page background. Pick an image or GIF here.')
    if (file.size > MAX_VIDEO) throw new Error('That video is over 40 MB. Try a shorter or smaller clip.')
    return file
  }
  if (!file.type.startsWith('image/')) throw new Error('Pick an image, GIF or video file.')
  if (file.type === 'image/gif') {
    if (file.size > MAX_GIF) throw new Error('That GIF is over 15 MB. Try a smaller one.')
    return file
  }
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('That image could not be read.'))
      i.src = url
    })
    const k = Math.min(1, 2000 / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * k)
    c.height = Math.round(img.height * k)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return await new Promise<Blob>((res, rej) =>
      c.toBlob(b => (b ? res(b) : rej(new Error('That image could not be processed.'))), 'image/jpeg', 0.86))
  } finally {
    URL.revokeObjectURL(url)
  }
}

export interface Wallpaper { url: string; kind: 'image' | 'video' }

/** `key` picks which stored file this instance manages, so the page can keep separate pictures (default: the app wallpaper). */
export function useWallpaper(key: string = KEY, allowVideo = true) {
  const [wall, setWall] = useState<Wallpaper | null>(null)
  const urlRef = useRef<string | null>(null)

  const apply = useCallback((blob: Blob | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = blob ? URL.createObjectURL(blob) : null
    setWall(blob && urlRef.current ? { url: urlRef.current, kind: blob.type.startsWith('video/') ? 'video' : 'image' } : null)
  }, [])

  useEffect(() => {
    let dead = false
    loadWallpaper(key).then(b => { if (!dead && b) apply(b) }).catch(() => { /* IndexedDB unavailable */ })
    return () => { dead = true }
  }, [apply, key])
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])

  /** Resolves to an error message, or null on success. */
  const setFile = useCallback(async (file: File): Promise<string | null> => {
    try {
      const blob = await prepare(file, allowVideo)
      await saveWallpaper(blob, key)
      apply(blob)
      return null
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') return 'Not enough browser storage for that file.'
      return e instanceof Error && e.message ? e.message : 'Could not save that file.'
    }
  }, [apply, key, allowVideo])

  const clear = useCallback(async () => {
    apply(null)
    try { await clearWallpaper(key) } catch { /* ignore */ }
  }, [apply, key])

  return { wall, setFile, clear }
}

/** `live` puts the chosen live scene behind the whole app; `dim` darkens the hero card; `blur` and `shade` are how blurred and how dark the wallpaper is behind the whole page (0 and 0 = fully clear). */
export type AppBg = 'default' | 'evolve' | 'custom'
export interface SceneSettings {
  theme: string; dim: number; blur: number; shade: number
  /** Use the chosen live scene as the app background instead of the options below. */
  live: boolean
  /** Which wallpaper sits behind the app: the bundled video ('default'), no wallpaper, just EVOLVE's ambient light ('evolve'), or the user's own upload ('custom'). */
  bg: AppBg
}
export const WALL_LIMITS = { blur: 60, shade: 0.85 }
export const SOFT_WALL = { blur: 44 }
/** Blur and darkness the default wallpaper starts with (and what "Default" restores). */
export const DEFAULT_WALL = { blur: 0, shade: 0.4 }
/** The wallpaper every new install starts with. Served from /public so it is not stored in the browser. */
export const DEFAULT_WALLPAPER: Wallpaper = { url: `${import.meta.env.BASE_URL}wallpapers/evolve-default.mp4`, kind: 'video' }
const clamp = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback

export function useSceneSettings() {
  const [s, setS] = useState<SceneSettings>(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      const p = JSON.parse(raw ?? 'null')
      const dim = Number.isFinite(p?.dim) ? Math.min(0.7, Math.max(0, p.dim)) : 0.25
      return {
        theme: typeof p?.theme === 'string' ? p.theme : 'dusk',
        live: p?.live === true,
        // Settings saved before this option existed keep whatever wallpaper they had (an upload, or the old ambient light).
        bg: p?.bg === 'default' || p?.bg === 'evolve' || p?.bg === 'custom' ? p.bg : raw ? 'custom' : 'default',
        dim,
        blur: clamp(p?.blur, 0, WALL_LIMITS.blur, DEFAULT_WALL.blur),
        shade: clamp(p?.shade, 0, WALL_LIMITS.shade, DEFAULT_WALL.shade),
      }
    } catch {
      return { theme: 'dusk', live: false, bg: 'default', dim: 0.25, blur: DEFAULT_WALL.blur, shade: DEFAULT_WALL.shade }
    }
  })
  const update = useCallback((patch: Partial<SceneSettings>) =>
    setS(cur => {
      const n = { ...cur, ...patch }
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(n)) } catch { /* ignore */ }
      return n
    }), [])
  return [s, update] as const
}
