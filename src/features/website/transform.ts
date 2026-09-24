import {
  changeGeometry,
  gridStep,
  snap,
  GRID_COLUMN,
  GRID_ROW,
  type GridSettings,
  type ResizeDirection,
  type WidgetGeometry,
} from './grid'

export function normalizeRotation(degrees: number) {
  return Math.round((((((degrees + 180) % 360) + 360) % 360) - 180) * 100) / 100
}
export function pointerRotation(
  rotation: number,
  startAngle: number,
  angle: number,
  stepped: boolean,
) {
  const degrees = rotation + ((angle - startAngle) * 180) / Math.PI
  return normalizeRotation(stepped ? Math.round(degrees / 15) * 15 : degrees)
}

// Work in pixels because the grid's horizontal and vertical units differ.
// Keep the opposite edge/corner fixed while resizing along the rotated axes.
export function resizeRotated(
  origin: WidgetGeometry,
  dx: number,
  dy: number,
  action: ResizeDirection,
  settings: GridSettings,
  rotation: number,
): WidgetGeometry {
  if (!rotation) return changeGeometry(origin, dx, dy, action, settings)
  const angle = (rotation * Math.PI) / 180,
    c = Math.cos(angle),
    s = Math.sin(angle)
  const localX = (c * dx * GRID_COLUMN + s * dy * GRID_ROW) / GRID_COLUMN
  const localY = (-s * dx * GRID_COLUMN + c * dy * GRID_ROW) / GRID_ROW
  const horizontal = action.includes('left') ? -1 : action.includes('right') ? 1 : 0
  const vertical = action.includes('top') ? -1 : action.includes('bottom') ? 1 : 0
  const w = horizontal
    ? Math.max(1, snap(origin.w + horizontal * localX, gridStep(settings, 'x')))
    : origin.w
  const h = vertical
    ? Math.max(1, snap(origin.h + vertical * localY, gridStep(settings, 'y')))
    : origin.h
  const shiftX = (horizontal * (w - origin.w) * GRID_COLUMN) / 2
  const shiftY = (vertical * (h - origin.h) * GRID_ROW) / 2
  const candidate = {
    ...origin,
    w,
    h,
    x: origin.x + (c * shiftX - s * shiftY) / GRID_COLUMN - (w - origin.w) / 2,
    y: origin.y + (s * shiftX + c * shiftY) / GRID_ROW - (h - origin.h) / 2,
  }
  let fraction = 1
  for (const [start, end, limit] of [
    [-origin.x, -candidate.x, 0],
    [-origin.y, -candidate.y, 0],
    [origin.x + origin.w, candidate.x + candidate.w, 1000],
    [origin.y + origin.h, candidate.y + candidate.h, 10000],
  ]) {
    if (end! > limit!) fraction = Math.min(fraction, (limit! - start!) / (end! - start!))
  }
  const round = (value: number) => Math.round(value * 1000) / 1000
  const result = { ...origin }
  for (const field of ['x', 'y', 'w', 'h'] as const)
    result[field] = round(origin[field] + (candidate[field] - origin[field]) * fraction)
  result.x = Math.max(0, Math.min(1000 - result.w, result.x))
  result.y = Math.max(0, Math.min(10000 - result.h, result.y))
  return result
}
