import type { SharedDashboardWidget as Widget, SharedDashboardScope } from './sharedDashboards'
import { validateSharedWidgets } from '../../../functions/src/sharedDashboardModel'
import { bounds, descendants, locked, rootSelection, snap, type Grid } from './editorGeometry'
import { arrangementPlacement, sameArrangementSurface } from './selectionArrangement'
import { fallbackPlacements, type Placement } from './widgetPlacement'

type Device = 'desktop' | 'tablet' | 'phone'
export type WidgetSurface = { parentId: string; region: string }
export type MoveSurface = WidgetSurface & {
  width: number
  scale: number
  positions: ReadonlyMap<string, Placement>
}
const inSurface = (w: Widget, surface: WidgetSurface) =>
  (w.parentId || '') === surface.parentId && (w.region || '0') === surface.region
const equal = (a: Placement, b: Placement) =>
  (['x', 'y', 'w', 'h'] as const).every((key) => Math.abs(a[key] - b[key]) < 1e-9)
const valid = (p: Placement | undefined): p is Placement =>
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

export function primaryMoveRoot(widgets: Widget[], ids: string[], primaryId: string) {
  const roots = rootSelection(widgets, ids),
    seen = new Set<string>()
  let entry = widgets.find((w) => w.id === primaryId)
  while (entry && !roots.includes(entry) && !seen.has(entry.id)) {
    seen.add(entry.id)
    entry = widgets.find((w) => w.id === entry!.parentId)
  }
  return entry && roots.includes(entry) ? entry : roots.at(-1)
}

export function resolveMoveSurface(
  widgets: Widget[],
  surface: WidgetSurface,
  device: Device,
  measured: ReadonlyMap<string, Placement>,
) {
  const siblings = widgets.filter((w) => inSurface(w, surface))
  if (!siblings.some((w) => arrangementPlacement(w, device))) return measured
  const positions = fallbackPlacements(
    siblings.map((w) => ({ ...w, placement: arrangementPlacement(w, device) })),
  )
  return new Map(siblings.map((w, i) => [w.id, positions[i]!]))
}

/** Shared hierarchy rules for pointer moves and the keyboard-accessible selectors. */
export function assignWidgetSurface(
  widgets: Widget[],
  ids: string[],
  target: WidgetSurface,
  device: Device,
  scope: SharedDashboardScope,
) {
  const reject = (reason: string) => ({ widgets, reason })
  const roots = rootSelection(widgets, ids)
  if (!roots.length || roots.some((w) => !sameArrangementSurface(w, roots[0]!)))
    return reject('Select widgets in one container region.')
  if (roots.some((w) => locked(widgets, w, 'positionLocked')))
    return reject('Unlock position for the selection and its containers first.')
  if (roots.every((w) => inSurface(w, target))) return reject('')
  if (device !== 'desktop')
    return reject(
      'Switch to Desktop to move between containers. Container assignments apply to every device.',
    )
  const parent = widgets.find((w) => w.id === target.parentId)
  if (!target.parentId && target.region !== '0') return reject('Choose a valid container region.')
  if (target.parentId && !parent?.container) return reject('Choose a valid container region.')
  if (parent && locked(widgets, parent, 'positionLocked'))
    return reject('The destination container is position locked.')
  if (
    descendants(
      widgets,
      roots.map((w) => w.id),
    ).some((w) => w.id === target.parentId)
  )
    return reject('A widget cannot move into itself or one of its children.')
  const next = widgets.map((w) => {
    if (!roots.includes(w)) return w
    const changed = { ...w }
    if (target.parentId) {
      changed.parentId = target.parentId
      changed.region = target.region
    } else {
      delete changed.parentId
      delete changed.region
    }
    return changed
  })
  try {
    validateSharedWidgets(next, scope)
  } catch {
    return reject(
      'This destination exceeds the supported container depth or has an invalid region.',
    )
  }
  return { widgets: next, reason: '' }
}

/** Reproject roots, not descendants, and preserve affected siblings before membership changes. */
export function planWidgetMove(options: {
  widgets: Widget[]
  ids: string[]
  primaryId: string
  device: Device
  scope: SharedDashboardScope
  source: MoveSurface
  target: MoveSurface
  point: { x: number; y: number }
  grid: Grid
  preserveLocalPlacement?: boolean
}) {
  const { widgets, ids, primaryId, device, scope, source, target, point, grid } = options
  const reject = (reason: string) => ({ widgets, reason, previews: [] as Placement[] })
  if (
    ![source.width, target.width, source.scale, target.scale].every(
      (v) => Number.isFinite(v) && v > 0,
    ) ||
    ![point.x, point.y].every(Number.isFinite)
  )
    return reject('The destination is not visible. Open its region before moving.')
  const roots = rootSelection(widgets, ids)
  if (!roots.length || roots.some((w) => !inSurface(w, source)))
    return reject('Select widgets in one container region.')
  const membership = assignWidgetSurface(widgets, ids, target, device, scope)
  if (membership.reason) return reject(membership.reason)
  const original = roots.map((w) => source.positions.get(w.id))
  if (!original.every(valid))
    return reject('The source widgets cannot be measured within the canvas limits.')
  const cross = source.parentId !== target.parentId || source.region !== target.region
  const ratio = cross && !options.preserveLocalPlacement ? source.scale / target.scale : 1
  const widthRatio =
    cross && !options.preserveLocalPlacement ? (source.width / target.width) * ratio : 1
  const projected = original.map((p) => ({
    x: p.x * widthRatio,
    y: p.y * ratio,
    w: p.w * widthRatio,
    h: p.h * ratio,
  }))
  if (projected.some((p) => p.w < 2 || p.w > 24 || p.h < 3 || p.h > 100))
    return reject('The selection does not fit this region at its current size. Resize it first.')
  const box = bounds(projected)
  if (box.w > 24 || box.h > 1000)
    return reject('The selection does not fit this region at its current size. Resize it first.')
  const primary = primaryMoveRoot(widgets, ids, primaryId)!
  const anchor = projected[roots.indexOf(primary)]!
  let dx = (point.x / target.width) * 24 - anchor.x,
    dy = point.y / 32 - anchor.y
  dx = snap(box.x + dx, grid.snap ? grid.x : 1 / 45) - box.x
  dy = snap(box.y + dy, grid.snap ? grid.y : 1 / 32) - box.y
  dx = Math.max(-box.x, Math.min(24 - box.x - box.w, dx))
  dy = Math.max(-box.y, Math.min(1000 - box.y - box.h, dy))
  const result = options.preserveLocalPlacement
    ? original
    : projected.map((p, i) => {
        const candidate = {
          ...p,
          x: Math.max(0, Math.min(24 - p.w, p.x + dx)),
          y: Math.max(0, Math.min(1000 - p.h, p.y + dy)),
        }
        return !cross && equal(candidate, original[i]!) ? original[i]! : candidate
      })
  if (!result.every(valid))
    return reject('The selection does not fit this region at its current size. Resize it first.')
  if (!cross && result.every((p, i) => p === original[i])) return reject('')
  const moving = new Set(roots.map((w) => w.id))
  const patches = new Map(roots.map((w, i) => [w.id, result[i]!]))
  for (const surface of cross ? [source, target] : [source]) {
    const before = widgets.filter((w) => inSurface(w, surface))
    const after = membership.widgets.filter((w) => inSurface(w, surface))
    const wasFlow = !before.some((w) => arrangementPlacement(w, device))
    const afterFallback = fallbackPlacements(
      after.map((w) => ({ ...w, placement: patches.get(w.id) || arrangementPlacement(w, device) })),
    )
    for (let i = 0; i < after.length; i++) {
      const sibling = after[i]!
      if (moving.has(sibling.id) || arrangementPlacement(sibling, device)) continue
      const p = surface.positions.get(sibling.id)
      if (!valid(p))
        return reject(
          'This region cannot keep its current layout. Open it and resize its widgets before moving.',
        )
      // Even a positioned surface's fallback order changes on insertion/removal.
      // Flow always needs pinning so it cannot reflow around a moved widget.
      if (
        wasFlow ||
        !after.some((w) => moving.has(w.id) || arrangementPlacement(w, device)) ||
        !equal(p, afterFallback[i]!)
      )
        patches.set(sibling.id, p)
    }
  }
  const next = membership.widgets.map((w) => {
    const placement = patches.get(w.id)
    if (!placement) return w
    if (
      !cross &&
      arrangementPlacement(w, device) &&
      equal(placement, arrangementPlacement(w, device)!)
    )
      return w
    return device === 'desktop'
      ? { ...w, placement }
      : { ...w, devices: { ...w.devices, [device]: placement } }
  })
  try {
    validateSharedWidgets(next, scope)
  } catch {
    return reject('This move cannot be saved within the current layout limits.')
  }
  return { widgets: next, reason: '', previews: result }
}
