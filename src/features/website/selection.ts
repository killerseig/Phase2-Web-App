import { copySection } from './pageTools'
import type { WebsiteSection } from './types'
import type { WidgetGeometry } from './grid'

export type GeometryMap = Record<string, WidgetGeometry>
export function selectionBounds(layouts: GeometryMap): WidgetGeometry | undefined {
  const values = Object.values(layouts)
  if (!values.length) return
  const x = Math.min(...values.map((value) => value.x))
  const y = Math.min(...values.map((value) => value.y))
  return {
    x,
    y,
    w: Math.max(...values.map((value) => value.x + value.w)) - x,
    h: Math.max(...values.map((value) => value.y + value.h)) - y,
    z: 0,
  }
}
export function translateSelection(layouts: GeometryMap, dx: number, dy: number): GeometryMap {
  const bounds = selectionBounds(layouts)
  if (!bounds) return {}
  dx = Math.max(-bounds.x, Math.min(1000 - bounds.x - bounds.w, dx))
  dy = Math.max(-bounds.y, Math.min(10000 - bounds.y - bounds.h, dy))
  const round = (value: number) => Math.round(value * 1000) / 1000
  return Object.fromEntries(
    Object.entries(layouts).map(([id, layout]) => [
      id,
      { ...layout, x: round(layout.x + dx), y: round(layout.y + dy) },
    ]),
  )
}
export function intersectingWidgets(layouts: GeometryMap, rect: WidgetGeometry): string[] {
  return Object.entries(layouts)
    .filter(
      ([, layout]) =>
        layout.x < rect.x + rect.w &&
        layout.x + layout.w > rect.x &&
        layout.y < rect.y + rect.h &&
        layout.y + layout.h > rect.y,
    )
    .map(([id]) => id)
}
export function cloneWidgets(
  source: WebsiteSection[],
  existing: WebsiteSection[],
  point?: { x: number; y: number },
): WebsiteSection[] {
  if (!source.length || source.length + existing.length > 30) return []
  const copies = source.map(copySection)
  const ids = new Map(source.map((section, index) => [section.id, copies[index]!.id]))
  for (const copy of copies)
    if (copy.parentId)
      copy.parentId =
        ids.get(copy.parentId) ||
        (existing.some((entry) => entry.id === copy.parentId) ? copy.parentId : undefined)
  const layouts = Object.fromEntries(
    copies.filter((entry) => entry.layout).map((entry) => [entry.id, entry.layout!]),
  )
  const bounds = selectionBounds(layouts)
  const moved = translateSelection(
    layouts,
    point && bounds ? point.x - bounds.x : 1,
    point && bounds ? point.y - bounds.y : 1,
  )
  const maxZ = Math.max(0, ...existing.map((entry) => entry.layout?.z || 0))
  const ordered = [...copies].sort((a, b) => (a.layout?.z || 0) - (b.layout?.z || 0))
  for (const [index, entry] of ordered.entries())
    if (moved[entry.id])
      entry.layout = { ...moved[entry.id]!, z: Math.min(10000, maxZ + index + 1) }
  return copies
}
export function layerSelection(sections: WebsiteSection[], ids: string[], front: boolean) {
  const selected = new Set(ids)
  const ordered = [...sections].sort((a, b) => (a.layout?.z || 0) - (b.layout?.z || 0))
  const group = ordered.filter((entry) => selected.has(entry.id))
  const rest = ordered.filter((entry) => !selected.has(entry.id))
  return Object.fromEntries(
    (front ? [...rest, ...group] : [...group, ...rest])
      .filter((entry) => entry.layout)
      .map((entry, index) => [entry.id, { ...entry.layout!, z: index + 1 }]),
  )
}
