/** A context-menu anchor is useful only while its exact visible surface is unchanged. */
export function captureWebsitePastePoint(
  event: MouseEvent,
  surface: HTMLElement | undefined,
  clips: (HTMLElement | undefined)[],
  current: () => boolean,
): (() => { x: number; y: number } | undefined) | undefined {
  if (!surface || !(event.target instanceof Node) || !surface.contains(event.target) ||
    !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY) || !surface.offsetWidth) return
  const elements = [surface, ...clips.filter((clip): clip is HTMLElement => !!clip)]
  const bounds = elements.map(element => element.getBoundingClientRect())
  const inside = (rect: DOMRect) => event.clientX >= rect.left && event.clientX < rect.right &&
    event.clientY >= rect.top && event.clientY < rect.bottom
  if (!bounds.every(inside)) return
  const rect = bounds[0]!
  const width = surface.offsetWidth
  const scale = rect.width / width
  if (!Number.isFinite(scale) || scale <= 0) return
  const point = { x: (event.clientX - rect.left) / (45 * scale), y: (event.clientY - rect.top) / (32 * scale) }
  return () => {
    if (!current() || surface.offsetWidth !== width) return
    if (elements.some((element, index) => {
      if (!element.isConnected) return true
      const next = element.getBoundingClientRect(), before = bounds[index]!
      return next.left !== before.left || next.top !== before.top || next.width !== before.width || next.height !== before.height
    })) return
    return point
  }
}
