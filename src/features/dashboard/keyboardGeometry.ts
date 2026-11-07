import { bounds, resizeEdges, resizeGroup, type Direction } from './editorGeometry'
import type { Placement } from './widgetPlacement'

export interface KeyboardGeometryIntent {
  key: string
  precise: boolean
  action: 'move' | 'resize'
  direction?: Direction
  surfaceWidth: number
  scale: number
  spacing: { x: number; y: number }
  positionLocked?: boolean
}

/** Keyboard deltas preserve off-grid offsets; Shift means one screen pixel. */
export function keyboardGeometry(
  original: readonly Placement[],
  intent: KeyboardGeometryIntent,
): Placement[] {
  const unchanged = () => original.map((p) => ({ ...p }))
  const { key, precise, action, surfaceWidth, scale, spacing } = intent
  if (
    !original.length ||
    !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key) ||
    ![surfaceWidth, scale, spacing.x, spacing.y].every((n) => Number.isFinite(n) && n > 0) ||
    original.some((p) => ![p.x, p.y, p.w, p.h].every(Number.isFinite)) ||
    (action === 'move' && intent.positionLocked)
  )
    return unchanged()
  const x = precise ? 24 / (surfaceWidth * scale) : spacing.x
  const y = precise ? 1 / (32 * scale) : spacing.y
  let dx = key === 'ArrowLeft' ? -x : key === 'ArrowRight' ? x : 0
  let dy = key === 'ArrowUp' ? -y : key === 'ArrowDown' ? y : 0
  if (action === 'resize') {
    // Resolve the relative keyboard step without re-snapping its absolute edge.
    const grid = { x: 0.000001, y: 0.000001, snap: true }
    return original.length === 1
      ? [
          resizeEdges(
            original[0]!,
            dx,
            dy,
            intent.direction || 'se',
            grid,
            intent.positionLocked,
            100,
            6,
          ),
        ]
      : resizeGroup(original, dx, dy, intent.direction || 'se', grid, 6)
  }
  const box = bounds([...original])
  dx = Math.max(-box.x, Math.min(24 - box.x - box.w, dx))
  dy = Math.max(-box.y, Math.min(1000 - box.y - box.h, dy))
  const round = (n: number) => +n.toFixed(6)
  return original.map((p) => ({
    ...p,
    x: dx === 0 ? p.x : Math.max(0, Math.min(24 - p.w, round(p.x + dx))),
    y: dy === 0 ? p.y : Math.max(0, Math.min(1000 - p.h, round(p.y + dy))),
  }))
}
