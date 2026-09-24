import { selectionBounds, type GeometryMap } from './selection'

export const arrangementActions = [
  { id: 'align-left', label: 'Align left' },
  { id: 'center-horizontal', label: 'Center horizontally' },
  { id: 'align-right', label: 'Align right' },
  { id: 'align-top', label: 'Align top' },
  { id: 'center-vertical', label: 'Center vertically' },
  { id: 'align-bottom', label: 'Align bottom' },
  { id: 'distribute-horizontal', label: 'Distribute horizontally' },
  { id: 'distribute-vertical', label: 'Distribute vertically' },
  { id: 'match-width', label: 'Match width' },
  { id: 'match-height', label: 'Match height' },
] as const
export type ArrangementAction = (typeof arrangementActions)[number]['id']

// Mirrors the networking editor's selection tools within this canvas's finite bounds.
// Explicit alignment is exact; snapping applies to subsequent pointer gestures.
export function arrangeSelection(
  layouts: GeometryMap,
  action: ArrangementAction,
  primaryId: string,
): GeometryMap {
  const entries = Object.entries(layouts)
  const bounds = selectionBounds(layouts)
  if (entries.length < 2 || !bounds) return {}
  const result = Object.fromEntries(entries.map(([id, layout]) => [id, { ...layout }]))
  const primary = layouts[primaryId] || entries.at(-1)![1]
  const round = (value: number) => Math.round(value * 1000) / 1000
  if (action.startsWith('distribute-')) {
    if (entries.length < 3) return {}
    const horizontal = action === 'distribute-horizontal'
    const axis = horizontal ? 'x' : 'y'
    const size = horizontal ? 'w' : 'h'
    const gap =
      (bounds[size] - entries.reduce((total, [, layout]) => total + layout[size], 0)) /
      (entries.length - 1)
    // Equal spacing needs enough room; do not introduce new overlaps.
    if (gap < 0) return {}
    const ordered = [...entries].sort((a, b) => a[1][axis] - b[1][axis])
    let cursor = bounds[axis]
    for (const [id, layout] of ordered) {
      result[id]![axis] = round(cursor)
      cursor += layout[size] + gap
    }
  } else {
    for (const layout of Object.values(result)) {
      switch (action) {
        case 'align-left':
          layout.x = bounds.x
          break
        case 'align-right':
          layout.x = round(bounds.x + bounds.w - layout.w)
          break
        case 'center-horizontal':
          layout.x = round(bounds.x + (bounds.w - layout.w) / 2)
          break
        case 'align-top':
          layout.y = bounds.y
          break
        case 'align-bottom':
          layout.y = round(bounds.y + bounds.h - layout.h)
          break
        case 'center-vertical':
          layout.y = round(bounds.y + (bounds.h - layout.h) / 2)
          break
        case 'match-width':
          layout.w = primary.w
          break
        case 'match-height':
          layout.h = primary.h
          break
      }
    }
  }
  // Keep matching sizes atomic instead of silently giving edge widgets a smaller size.
  if (
    Object.values(result).some(
      (layout) => layout.x + layout.w > 1000 || layout.y + layout.h > 10000,
    )
  )
    return {}
  return Object.fromEntries(
    Object.entries(result).filter(([id, layout]) =>
      (['x', 'y', 'w', 'h'] as const).some((field) => layout[field] !== layouts[id]![field]),
    ),
  )
}
