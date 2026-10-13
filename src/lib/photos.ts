import { useEffect, useState } from 'react'

/**
 * Photo notes.
 * Pictures are far too big for localStorage (about 5 MB for the whole app), so each photo is shrunk and stored
 * as a file-like blob in IndexedDB on the device. The note itself only keeps the photo's id.
 */
const DB = 'evolve-photos', STORE = 'photos'
export const MAX_PHOTOS = 8
const MAX_SIDE = 1600
const QUALITY = 0.82

const open = () =>
  new Promise<IDBDatabase>((res, rej) => {
    if (typeof indexedDB === 'undefined') { rej(new Error('This device does not allow saving photos.')); return }
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open()
  try {
    return await new Promise<T | undefined>((res, rej) => {
      const tx = db.transaction(STORE, mode)
      const req = fn(tx.objectStore(STORE))
      tx.oncomplete = () => res(req ? req.result : undefined)
      tx.onerror = tx.onabort = () => rej(tx.error)
    })
  } finally {
    db.close()
  }
}

/** Shrinks a picked or captured photo (keeps its rotation) so many photos fit comfortably on the phone. */
async function shrink(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Please pick an image file.')
  let src: ImageBitmap | HTMLImageElement
  let url = ''
  try {
    if ('createImageBitmap' in window) {
      src = await createImageBitmap(file, { imageOrientation: 'from-image' })
    } else {
      url = URL.createObjectURL(file)
      src = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image()
        i.onload = () => res(i)
        i.onerror = () => rej(new Error())
        i.src = url
      })
    }
  } catch {
    if (url) URL.revokeObjectURL(url)
    throw new Error('That photo could not be read. Try a JPG or PNG.')
  }
  try {
    const w = 'naturalWidth' in src ? src.naturalWidth : src.width
    const h = 'naturalHeight' in src ? src.naturalHeight : src.height
    const k = Math.min(1, MAX_SIDE / Math.max(w, h))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(w * k))
    c.height = Math.max(1, Math.round(h * k))
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff' // transparent PNGs would turn black as JPEG
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(src, 0, 0, c.width, c.height)
    return await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('That photo could not be processed.'))), 'image/jpeg', QUALITY))
  } finally {
    if (url) URL.revokeObjectURL(url)
    if ('close' in src) src.close()
  }
}

let asked = false
/** Asks the browser not to clear stored photos when the phone is low on space. Harmless if refused. */
function keepSafe() {
  if (asked) return
  asked = true
  try { void navigator.storage?.persist?.() } catch { /* not supported */ }
}

/** Shrinks and stores one photo, returning the id to keep on the note. */
export async function savePhoto(file: File): Promise<string> {
  const blob = await shrink(file)
  const id = crypto.randomUUID()
  try {
    keepSafe()
    await run('readwrite', s => s.put(blob, id))
  } catch {
    throw new Error('Could not save the photo. The phone may be out of space.')
  }
  return id
}

export const loadPhoto = (id: string) => run<Blob>('readonly', s => s.get(id) as IDBRequest<Blob>)

/** Deletes photos that no longer belong to any note. Never throws. */
export async function deletePhotos(ids: string[]) {
  if (!ids.length) return
  try { await run('readwrite', s => { ids.forEach(i => s.delete(i)) }) } catch { /* nothing to clean */ }
}

export async function clearAllPhotos() {
  try { await run('readwrite', s => s.clear()) } catch { /* nothing to clean */ }
}

/** A temporary address for showing a stored photo in an <img>. Released when the picture leaves the screen. */
export function usePhotoUrl(id: string) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let dead = false, made = ''
    setUrl(null)
    loadPhoto(id).then(b => { if (dead || !b) return; made = URL.createObjectURL(b); setUrl(made) }).catch(() => { /* unavailable */ })
    return () => { dead = true; if (made) URL.revokeObjectURL(made) }
  }, [id])
  return url
}
