import type { SharedDashboardWidget as Widget } from './sharedDashboards'
import { placeWidget, type Placement } from './widgetPlacement'
export type Direction = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'
export const resizeDirections: Direction[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
export type Grid = { x: number; y: number; snap: boolean }
export const snap = (v: number, step: number) =>
  Number.isFinite(step) && step > 0 ? Math.round(v / step) * step : v
export function resizeEdges(
  p: Placement,
  dx: number,
  dy: number,
  direction: Direction,
  grid: Grid,
  positionLocked = false,
  maxHeight = 100,
): Placement {
  const gx = grid.snap ? grid.x : 1 / 45,
    gy = grid.snap ? grid.y : 1 / 32
  let left = p.x,
    right = p.x + p.w,
    top = p.y,
    bottom = p.y + p.h
  if (direction.includes('w') && !positionLocked)
    left = Math.max(0, Math.min(right - 2, snap(p.x + dx, gx)))
  if (direction.includes('n') && !positionLocked)
    top = Math.max(0, Math.min(bottom - 3, Math.max(bottom - maxHeight, snap(p.y + dy, gy))))
  if (direction.includes('e')) right = Math.max(left + 2, Math.min(24, snap(p.x + p.w + dx, gx)))
  if (direction.includes('s'))
    bottom = Math.max(top + 3, Math.min(1000, top + maxHeight, snap(p.y + p.h + dy, gy)))
  return {
    x: +left.toFixed(3),
    y: +top.toFixed(3),
    w: +(right - left).toFixed(3),
    h: +(bottom - top).toFixed(3),
  }
}
export function bounds(placements: Placement[]) {
  const x = Math.min(...placements.map((p) => p.x)),
    y = Math.min(...placements.map((p) => p.y))
  return {
    x,
    y,
    w: Math.max(...placements.map((p) => p.x + p.w)) - x,
    h: Math.max(...placements.map((p) => p.y + p.h)) - y,
  }
}
export function translate(placements: Placement[], dx: number, dy: number, grid: Grid) {
  const b = bounds(placements)
  dx = Math.max(-b.x, Math.min(24 - b.x - b.w, snap(b.x + dx, grid.snap ? grid.x : 1 / 45) - b.x))
  dy = Math.max(-b.y, Math.min(1000 - b.y - b.h, snap(b.y + dy, grid.snap ? grid.y : 1 / 32) - b.y))
  return placements.map((p) => placeWidget(p.x + dx, p.y + dy, p.w, p.h, false))
}
export type Arrangement =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'
  | 'horizontal'
  | 'vertical'
  | 'width'
  | 'height'
export function arrange(placements: Placement[], operation: Arrangement, primary: Placement) {
  const b = bounds(placements)
  const horizontal = operation === 'horizontal',
    vertical = operation === 'vertical'
  if (horizontal || vertical) {
    if (placements.length < 3) return placements
    const axis = horizontal ? 'x' : 'y',
      size = horizontal ? 'w' : 'h'
    const sorted = placements.map((p, i) => ({ ...p, i })).sort((a, c) => a[axis] - c[axis])
    const last = sorted[sorted.length - 1]!
    const gap =
      (last[axis] + last[size] - sorted[0]![axis] - sorted.reduce((sum, p) => sum + p[size], 0)) /
      (sorted.length - 1)
    let cursor = sorted[0]![axis]
    const result = placements.map((p) => ({ ...p }))
    for (const p of sorted) {
      result[p.i]![axis] = +cursor.toFixed(3)
      cursor += p[size] + gap
    }
    return result
  }
  return placements.map((p) =>
    placeWidget(
      operation === 'left'
        ? b.x
        : operation === 'center'
          ? b.x + (b.w - p.w) / 2
          : operation === 'right'
            ? b.x + b.w - p.w
            : p.x,
      operation === 'top'
        ? b.y
        : operation === 'middle'
          ? b.y + (b.h - p.h) / 2
          : operation === 'bottom'
            ? b.y + b.h - p.h
            : p.y,
      operation === 'width' ? primary.w : p.w,
      operation === 'height' ? primary.h : p.h,
      false,
    ),
  )
}
export function descendants(widgets: Widget[], ids: string[]) {
  const result = new Set(ids)
  for (let i = 0; i < widgets.length; i++)
    for (const widget of widgets)
      if (widget.parentId && result.has(widget.parentId)) result.add(widget.id)
  return widgets.filter((w) => result.has(w.id))
}
export function rootSelection(widgets: Widget[], ids: string[]) {
  const all = new Map(widgets.map((w) => [w.id, w]))
  return widgets.filter(
    (w) =>
      ids.includes(w.id) &&
      (() => {
        let parent = w.parentId
        const seen = new Set<string>()
        while (parent && !seen.has(parent)) {
          if (ids.includes(parent)) return false
          seen.add(parent)
          parent = all.get(parent)?.parentId
        }
        return true
      })(),
  )
}
export function locked(widgets: Widget[], widget: Widget, key: 'positionLocked' | 'sizeLocked') {
  const seen = new Set<string>()
  let current: Widget | undefined = widget
  while (current && !seen.has(current.id)) {
    if (current[key]) return true
    seen.add(current.id)
    current = widgets.find((w) => w.id === current!.parentId)
  }
  return false
}
export function copyConfiguration(widgets: Widget[], ids: string[]) {
  const roots = rootSelection(widgets, ids)
  const entries: Widget[] = JSON.parse(
    JSON.stringify(
      descendants(
        widgets,
        roots.map((w) => w.id),
      ),
    ),
  )
  const mapping = new Map(entries.map((w) => [w.id, crypto.randomUUID()]))
  return entries.map((w) => {
    const parentId = w.parentId && mapping.get(w.parentId)
    const result = { ...w, id: mapping.get(w.id)! }
    if (result.type === 'notes') result.text = ''
    if (parentId) result.parentId = parentId
    else {
      delete result.parentId
      delete result.region
      if (result.placement)
        result.placement = placeWidget(
          result.placement.x + 1,
          result.placement.y + 1,
          result.placement.w,
          result.placement.h,
          false,
        )
    }
    return result
  })
}
