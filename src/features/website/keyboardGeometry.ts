import { GRID_COLUMN, GRID_ROW, gridStep, type GridSettings, type ResizeDirection } from './grid'
import { selectionBounds, type GeometryMap } from './selection'

export const KEYBOARD_GEOMETRY_PRECISION = 12

export interface KeyboardGeometryIntent {
  key: string
  precise: boolean
  action: 'move' | ResizeDirection
  scale: number
  settings: GridSettings
}

/** Keyboard steps are relative to authored geometry, independent of pointer snapping. */
export function keyboardGeometry(
  original: GeometryMap,
  intent: KeyboardGeometryIntent,
): GeometryMap {
  const entries = Object.entries(original)
  const result = Object.fromEntries(entries.map(([id, layout]) => [id, { ...layout }]))
  const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
    intent.key
  ]
  if (
    !direction ||
    !entries.length ||
    !Number.isFinite(intent.scale) ||
    intent.scale <= 0 ||
    entries.some(([, layout]) => ![layout.x, layout.y, layout.w, layout.h].every(Number.isFinite))
  )
    return result
  const stepX = intent.precise ? 1 / (GRID_COLUMN * intent.scale) : gridStep(intent.settings, 'x')
  const stepY = intent.precise ? 1 / (GRID_ROW * intent.scale) : gridStep(intent.settings, 'y')
  if (![stepX, stepY].every((value) => Number.isFinite(value) && value > 0)) return result
  let dx = direction[0]! * stepX,
    dy = direction[1]! * stepY
  const round = (value: number) => Number(value.toFixed(KEYBOARD_GEOMETRY_PRECISION))
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
  if (intent.action === 'move') {
    const bounds = selectionBounds(original)!
    dx = clamp(dx, -bounds.x, 1000 - bounds.x - bounds.w)
    dy = clamp(dy, -bounds.y, 10000 - bounds.y - bounds.h)
    for (const [id, layout] of entries) {
      if (dx !== 0) result[id]!.x = clamp(round(layout.x + dx), 0, 1000 - layout.w)
      if (dy !== 0) result[id]!.y = clamp(round(layout.y + dy), 0, 10000 - layout.h)
    }
    return result
  }
  // Website resize controls operate on a single widget, not the entire selection.
  if (entries.length !== 1) return result
  const [id, origin] = entries[0]!,
    next = result[id]!
  if (dx !== 0 && intent.action.includes('left')) {
    next.x = clamp(round(origin.x + dx), 0, origin.x + origin.w - 1)
    if (next.x !== origin.x) next.w = Math.min(origin.w + origin.x - next.x, 1000 - next.x)
  }
  if (dy !== 0 && intent.action.includes('top')) {
    next.y = clamp(round(origin.y + dy), 0, origin.y + origin.h - 1)
    if (next.y !== origin.y) next.h = Math.min(origin.h + origin.y - next.y, 10000 - next.y)
  }
  if (dx !== 0 && intent.action.includes('right'))
    next.w = clamp(round(origin.w + dx), 1, 1000 - origin.x)
  if (dy !== 0 && intent.action.includes('bottom'))
    next.h = clamp(round(origin.h + dy), 1, 10000 - origin.y)
  return result
}
