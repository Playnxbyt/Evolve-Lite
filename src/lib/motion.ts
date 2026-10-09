/**
 * "Something big is resizing" flag. While a card or panel animates its height, heavy always-on loops
 * (the wallpaper video, the live scene, the pet and the orb) rest so the resize gets the whole frame budget.
 * Sets <html data-motion> while any source is moving; each source is tracked by name, so a cancelled
 * animation can never leave the page stuck in the "moving" state.
 */
const active = new Set<string>()

export function setMotion(source: string, moving: boolean) {
  if (typeof document === 'undefined') return
  if (moving && document.documentElement.dataset.visuals === 'extended') return // Extended visuals: loops keep running
  if (moving) active.add(source); else active.delete(source)
  document.documentElement.toggleAttribute('data-motion', active.size > 0)
}
