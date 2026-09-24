import type { WebsiteSection } from './types'
import { layoutLocked } from './containers'

// Matches Networking-Application's dashboardModel and viewport defaults.
export const GRID_COLUMN = 45
export const GRID_ROW = 32
export const GRID_COLUMNS = 24
export const GRID_MIN_ROWS = 18
export interface WidgetGeometry {
  x: number
  y: number
  w: number
  h: number
  z: number
}
export interface GridSettings {
  visible: boolean
  snap: boolean
  spacingX: number
  spacingY: number
}
export const defaultGrid = (): GridSettings => ({
  visible: true,
  snap: true,
  spacingX: 1,
  spacingY: 1,
})
export const resizeDirections = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
] as const
export type ResizeDirection = (typeof resizeDirections)[number]
export type WidgetAction = 'move' | 'rotate' | 'height' | ResizeDirection
export interface GridDraft {
  id: string
  layout: WidgetGeometry
  type?: string
  layouts?: Record<string, WidgetGeometry>
  rotation?: number
  rotationSnapped?: boolean
  heightOnly?: boolean
}
const round = (value: number) => Math.round(value * 1000) / 1000
export function snap(value: number, step: number) {
  return round(Math.round(value / step) * step)
}
export function gridStep(settings: GridSettings, axis: 'x' | 'y') {
  return settings.snap
    ? axis === 'x'
      ? settings.spacingX
      : settings.spacingY
    : 1 / (axis === 'x' ? GRID_COLUMN : GRID_ROW)
}
export function changeGeometry(
  origin: WidgetGeometry,
  dx: number,
  dy: number,
  action: 'move' | ResizeDirection,
  settings: GridSettings,
): WidgetGeometry {
  const result = { ...origin }
  const sx = gridStep(settings, 'x'),
    sy = gridStep(settings, 'y')
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
  if (action === 'move') {
    result.x = clamp(snap(origin.x + dx, sx), 0, 1000 - origin.w)
    result.y = clamp(snap(origin.y + dy, sy), 0, 10000 - origin.h)
  } else {
    if (action.includes('left')) {
      result.x = clamp(snap(origin.x + dx, sx), 0, origin.x + origin.w - 1)
      result.w = round(origin.w + origin.x - result.x)
    }
    if (action.includes('top')) {
      result.y = clamp(snap(origin.y + dy, sy), 0, origin.y + origin.h - 1)
      result.h = round(origin.h + origin.y - result.y)
    }
    if (action.includes('right')) result.w = clamp(snap(origin.w + dx, sx), 1, 1000 - origin.x)
    if (action.includes('bottom')) result.h = clamp(snap(origin.h + dy, sy), 1, 10000 - origin.y)
  }
  return result
}
export function geometryStyle(layout: WidgetGeometry) {
  return {
    left: `${layout.x * GRID_COLUMN}px`,
    top: `${layout.y * GRID_ROW}px`,
    width: `${layout.w * GRID_COLUMN}px`,
    height: `${layout.h * GRID_ROW}px`,
    zIndex: layout.z,
  }
}

// Keep the spacing between rows when a section changes height. Overlapping
// decorations and widgets alongside it retain their authored positions.
export function resizeWithFollowing(
  sections: WebsiteSection[],
  id: string,
  next: WidgetGeometry,
): Record<string, WidgetGeometry> {
  const section = sections.find((entry) => entry.id === id)
  const origin = section?.layout
  const result = { [id]: { ...next } }
  if (!origin || section.parentId || next.h === origin.h || layoutLocked(sections, id))
    return result
  const bottom = origin.y + origin.h
  const delta = Math.round((next.y + next.h - bottom) * 1000) / 1000
  if (!delta) return result
  const following = sections.filter(
    (entry) =>
      entry.id !== id &&
      !entry.parentId &&
      entry.layout &&
      entry.layout.y >= bottom - 0.0001 &&
      !layoutLocked(sections, entry.id),
  )
  // Constrain the whole change together so gaps remain intact at canvas limits.
  const shift = Math.min(
    delta,
    ...following.map((entry) => 10000 - entry.layout!.y - entry.layout!.h),
  )
  const height = Math.round((next.h + shift - delta) * 1000) / 1000
  if (height < 1) return { [id]: { ...origin } }
  result[id]!.h = height
  for (const entry of following)
    result[entry.id] = { ...entry.layout!, y: Math.round((entry.layout!.y + shift) * 1000) / 1000 }
  return result
}
export function gridExtent(layouts: WidgetGeometry[]) {
  return {
    width:
      Math.max(GRID_COLUMNS, ...layouts.map((layout) => Math.ceil(layout.x + layout.w))) *
      GRID_COLUMN,
    height:
      Math.max(GRID_MIN_ROWS, ...layouts.map((layout) => Math.ceil(layout.y + layout.h))) *
      GRID_ROW,
  }
}
export function materializeGrid(sections: WebsiteSection[]) {
  let x = 0,
    y = 0,
    rowHeight = 0
  return sections.map((section, index) => {
    if (section.layout) {
      y = Math.max(y, section.layout.y + section.layout.h)
      x = 0
      rowHeight = 0
      return section
    }
    const w = (section.span || 12) * 2
    const textRows = Math.ceil(
      (section.text.length / Math.max(20, w * 4) + section.text.split('\n').length) * 0.75,
    )
    const h = Math.min(
      100,
      Math.max(
        section.type === 'hero' ? 12 : section.imageId || section.items.length ? 14 : 6,
        textRows + 5,
      ),
    )
    if (x + w > GRID_COLUMNS) {
      y += rowHeight
      x = 0
      rowHeight = 0
    }
    const layout: WidgetGeometry = { x, y, w, h, z: index + 1 }
    x += w
    rowHeight = Math.max(rowHeight, h)
    if (x === GRID_COLUMNS) {
      y += rowHeight
      x = 0
      rowHeight = 0
    }
    return { ...section, layout }
  })
}
export function nextGeometry(
  sections: WebsiteSection[],
  type = 'text',
  size?: { w: number; h: number },
): WidgetGeometry {
  const layouts = materializeGrid(sections).map((section) => section.layout!)
  const componentSizes: Record<string, { w: number; h: number }> = {
    card: { w: 8, h: 11 },
    'profile-card': { w: 6, h: 10 },
    metric: { w: 6, h: 5 },
    'progress-ring': { w: 6, h: 7 },
    sparkline: { w: 8, h: 6 },
    'data-table': { w: 10, h: 10 },
    chart: { w: 10, h: 9 },
  }
  size ??= componentSizes[type]
  const w = size?.w ?? (['hero', 'navigation', 'footer'].includes(type) ? 24 : 8)
  const h = size?.h ?? (type === 'hero' ? 12 : ['navigation', 'footer'].includes(type) ? 4 : 8)
  return {
    x: 0,
    y: Math.min(10000 - h, Math.max(0, ...layouts.map((layout) => layout.y + layout.h))),
    w,
    h,
    z: Math.min(10000, Math.max(0, ...layouts.map((layout) => layout.z)) + 1),
  }
}
