import { normalizeRotation } from './transform'

// Sample actual pointer events, not animation frames: pausing/releasing must not
// change the angle that was just shown. Slow adjustments immediately release snap.
export function rotationAssist(initial: number, time: number) {
  let previous = initial,
    previousTime = time,
    fast = false
  return {
    update(angle: number, at: number, shift = false, alt = false) {
      const delta = Math.abs(normalizeRotation(angle - previous))
      if (delta > 0.01) {
        fast = (delta * 1000) / Math.max(8, at - previousTime) >= 120
        previous = angle
        previousTime = at
      }
      const step = shift ? 15 : 45
      const nearest = normalizeRotation(Math.round(angle / step) * step)
      const snapped = !alt && (shift || (fast && Math.abs(normalizeRotation(angle - nearest)) <= 8))
      return { angle: snapped ? nearest : normalizeRotation(angle), snapped }
    },
  }
}

export interface AlignmentRect {
  left: number
  top: number
  width: number
  height: number
}
export interface AlignmentGuide {
  axis: 'x' | 'y'
  at: number
  from: number
  to: number
}
export function alignMove(
  rect: AlignmentRect,
  targets: AlignmentRect[],
  engage = true,
  tolerance = 5,
) {
  const guides: AlignmentGuide[] = []
  const offsets = { x: 0, y: 0 }
  for (const axis of ['x', 'y'] as const) {
    const start = axis === 'x' ? 'left' : 'top',
      size = axis === 'x' ? 'width' : 'height'
    const other = axis === 'x' ? 'top' : 'left',
      otherSize = axis === 'x' ? 'height' : 'width'
    let nearest: { distance: number; at: number; target: AlignmentRect } | undefined
    for (const target of targets)
      for (const targetEdge of [0, 0.5, 1])
        for (const movingEdge of [0, 0.5, 1]) {
          const at = target[start] + target[size] * targetEdge
          const distance = at - rect[start] - rect[size] * movingEdge
          if (
            Math.abs(distance) <= tolerance &&
            (!nearest || Math.abs(distance) < Math.abs(nearest.distance))
          )
            nearest = { distance, at, target }
        }
    if (nearest) {
      offsets[axis] = engage ? nearest.distance : 0
      guides.push({
        axis,
        at: nearest.at,
        from: Math.min(rect[other], nearest.target[other]),
        to: Math.max(
          rect[other] + rect[otherSize],
          nearest.target[other] + nearest.target[otherSize],
        ),
      })
    }
  }
  return { ...offsets, guides }
}
