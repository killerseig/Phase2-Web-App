import type { SharedDashboardWidget as Widget } from './sharedDashboards'
import { arrange, locked, rootSelection, type Arrangement } from './editorGeometry'
import { fallbackPlacements, type Placement } from './widgetPlacement'

export const arrangementLabels = {
  left: 'Align left',
  center: 'Center horizontally',
  right: 'Align right',
  top: 'Align top',
  middle: 'Center vertically',
  bottom: 'Align bottom',
  horizontal: 'Distribute horizontally',
  vertical: 'Distribute vertically',
  width: 'Match width',
  height: 'Match height',
} satisfies Record<Arrangement, string>
type Device = 'desktop' | 'tablet' | 'phone'
export const sameArrangementSurface = (a: Widget, b: Widget) =>
  (a.parentId || '') === (b.parentId || '') && (a.region || '0') === (b.region || '0')
export const arrangementPlacement = (w: Widget, device: Device) =>
  device === 'desktop' ? w.placement : w.devices?.[device] || w.placement

/** Shared UI/command eligibility. Atomic locks deliberately differ from Networking. */
export function arrangementSelection(
  widgets: Widget[],
  ids: string[],
  primaryId: string,
  operation: Arrangement,
) {
  const roots = rootSelection(widgets, ids)
  const minimum = operation === 'horizontal' || operation === 'vertical' ? 3 : 2
  let primary = widgets.find((w) => w.id === primaryId)
  const seen = new Set<string>()
  while (primary && !roots.includes(primary) && !seen.has(primary.id)) {
    seen.add(primary.id)
    primary = widgets.find((w) => w.id === primary!.parentId)
  }
  if (!primary || !roots.includes(primary)) primary = roots.at(-1)
  const size = operation === 'width' || operation === 'height'
  const reason =
    roots.length < minimum
      ? `Select at least ${minimum} outermost widgets.`
      : roots.some((w) => !sameArrangementSurface(w, roots[0]!))
        ? 'Select widgets in the same container region.'
        : roots.some((w) => locked(widgets, w, size ? 'sizeLocked' : 'positionLocked'))
          ? `Unlock ${size ? 'size' : 'position'} for every selected widget and its containers.`
          : ''
  return { roots, primary, reason }
}

function valid(p: Placement | undefined): p is Placement {
  return (
    !!p &&
    [p.x, p.y, p.w, p.h].every(Number.isFinite) &&
    p.x >= 0 &&
    p.y >= 0 &&
    p.w >= 2 &&
    p.w <= 24 &&
    p.h >= 3 &&
    p.h <= 100 &&
    p.x + p.w <= 24.001 &&
    p.y + p.h <= 1000
  )
}

/** Propose one immutable edit; unchanged/error results retain the original array. */
export function planArrangement(options: {
  widgets: Widget[]
  ids: string[]
  primaryId: string
  device: Device
  operation: Arrangement
  measurements?: ReadonlyMap<string, Placement>
}) {
  const { widgets, ids, primaryId, device, operation, measurements } = options
  const selection = arrangementSelection(widgets, ids, primaryId, operation)
  const blocked = (reason: string) => ({ widgets, reason })
  if (selection.reason) return blocked(selection.reason)
  const { roots, primary } = selection
  const siblings = widgets.filter((w) => sameArrangementSurface(w, roots[0]!))
  const positioned = siblings.some((w) => arrangementPlacement(w, device))
  // Match the canvas's surface-local fallback order. Unplaced siblings in an
  // already-positioned region need no authored geometry to retain their layout.
  const fallback = fallbackPlacements(
    siblings.map((w) => ({ ...w, placement: arrangementPlacement(w, device) })),
  )
  const positions = positioned
    ? new Map(siblings.map((w, i) => [w.id, fallback[i]!]))
    : measurements || new Map<string, Placement>()
  const original = roots.map((w) => positions.get(w.id))
  if (!original.every(valid))
    return blocked(
      'Open this container region and ensure its widgets fit the canvas before arranging.',
    )
  const result = arrange(original, operation, positions.get(primary!.id)!)
  if (result.every((p, i) => p === original[i])) return blocked('')
  if (!result.every(valid))
    return blocked('This arrangement does not fit the canvas. Move or resize the selection first.')
  // A first placement switches the whole region out of flow. Preserve every
  // direct sibling's measured box, but never materialize other regions/children.
  if (!positioned && siblings.some((w) => !valid(positions.get(w.id))))
    return blocked(
      'This region cannot keep its current layout within the canvas limits. Resize its widgets before arranging.',
    )
  const patches = new Map<string, Placement>()
  if (!positioned) siblings.forEach((w) => patches.set(w.id, positions.get(w.id)!))
  roots.forEach((w, i) => {
    if (result[i] !== original[i]) patches.set(w.id, result[i]!)
  })
  const next = widgets.map((w) => {
    const placement = patches.get(w.id)
    if (!placement) return w
    return device === 'desktop'
      ? { ...w, placement }
      : { ...w, devices: { ...w.devices, [device]: placement } }
  })
  return { widgets: next, reason: '' }
}
