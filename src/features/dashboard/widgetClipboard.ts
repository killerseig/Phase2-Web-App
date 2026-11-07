import type { SharedDashboardWidget as Widget } from './sharedDashboards'
import { bounds, descendants, rootSelection, snap } from './editorGeometry'
import { fallbackPlacements, type Placement } from './widgetPlacement'

export type ClipboardDevice = 'desktop' | 'tablet' | 'phone'
export interface ClipboardAnchor {
  x: number
  y: number
  parentId: string
  region: string
}
export interface WidgetClipboard {
  context: string
  device: ClipboardDevice
  positions: Record<string, Placement>
  widgets: Widget[]
  roots: string[]
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const surface = (w: Widget) => `${w.parentId || ''}:${w.region || '0'}`

export function captureWidgetClipboard(
  widgets: Widget[],
  ids: string[],
  context: string,
  device: ClipboardDevice,
  measured: Placement[],
): WidgetClipboard {
  const roots = rootSelection(widgets, ids)
  if (!roots.length) throw Error('Select a widget to copy.')
  if (new Set(roots.map(surface)).size !== 1)
    throw Error('Select widgets in one container region at a time.')
  const entries = clone(
    descendants(
      widgets,
      roots.map((w) => w.id),
    ),
  )
  const positioned = widgets.some(
    (w) =>
      surface(w) === surface(roots[0]!) &&
      (w.placement || (device !== 'desktop' && w.devices?.[device])),
  )
  for (const w of entries) {
    if (w.type === 'notes') w.text = ''
    // Resolve only legacy siblings on an already positioned surface. Fully
    // flowing layouts stay flowing; copying never rewrites source widgets.
    if (positioned && roots.some((root) => root.id === w.id)) {
      const p = measured[widgets.findIndex((entry) => entry.id === w.id)]
      if (p && device === 'desktop' && !w.placement) w.placement = { ...p }
      else if (p && device !== 'desktop' && !w.devices?.[device] && !w.placement)
        w.devices = { ...w.devices, [device]: { ...p } }
    }
  }
  const fallback = footprints(widgets, device)
  return {
    context,
    device,
    widgets: entries,
    roots: roots.map((w) => w.id),
    positions: Object.fromEntries(
      roots.map((w) => [
        w.id,
        { ...(measured[widgets.findIndex((entry) => entry.id === w.id)] || fallback.get(w.id)!) },
      ]),
    ),
  }
}

function footprints(widgets: Widget[], device: ClipboardDevice): Map<string, Placement> {
  const result = new Map<string, Placement>()
  for (const region of new Set(widgets.map(surface))) {
    const entries = widgets.filter((w) => surface(w) === region)
    const placements = fallbackPlacements(
      entries.map((w) => ({
        ...w,
        placement: device === 'desktop' ? w.placement : w.devices?.[device] || w.placement,
      })),
    )
    entries.forEach((w, i) => result.set(w.id, placements[i]!))
  }
  return result
}

/** Copies configuration only. Placement is deterministic from current occupancy,
 * so Undo frees a cascade position and a failed paste consumes nothing. */
export function materializeWidgetClipboard(
  clipboard: WidgetClipboard,
  destination: Widget[],
  context: string,
  device: ClipboardDevice,
  spacing: { x: number; y: number; snap?: boolean },
  measured: Placement[] = [],
  anchor?: ClipboardAnchor,
): { widgets: Widget[]; roots: string[] } {
  if (
    !clipboard.roots.length ||
    new Set(clipboard.widgets.map((w) => w.id)).size !== clipboard.widgets.length
  )
    throw Error('The copied widget selection is invalid. Copy it again.')
  if (destination.length + clipboard.widgets.length > 12)
    throw Error('This selection would exceed the 12-widget limit.')
  if (![spacing.x, spacing.y].every((n) => Number.isFinite(n) && n > 0))
    throw Error('Set valid grid spacing before pasting.')
  const copies = clone(clipboard.widgets)
  const roots = copies.filter((w) => clipboard.roots.includes(w.id))
  if (roots.length !== clipboard.roots.length)
    throw Error('The copied widget selection is invalid.')
  for (const w of roots) {
    const parent = destination.find((entry) => entry.id === w.parentId && entry.container)
    const regions =
      parent?.container?.kind === 'tabs'
        ? parent.container.labels.length
        : parent?.container?.kind === 'split'
          ? 2
          : 1
    if (clipboard.context !== context || !parent || Number(w.region || '0') >= regions) {
      delete w.parentId
      delete w.region
    }
  }
  // A flow copy can enter a positioned destination later or in another scope.
  // Resolve the copy alone; never convert or reposition existing destination widgets.
  const originalRoots = new Map(roots.map((w) => [w.id, clone(w)]))
  for (const view of ['desktop', 'tablet', 'phone'] as const) {
    const fallback = footprints(clipboard.widgets, view)
    for (const w of roots) {
      const original = originalRoots.get(w.id)!
      const p =
        view === 'desktop' ? original.placement : original.devices?.[view] || original.placement
      // Other unauthored views can inherit the new base. The captured view must
      // retain its measured size rather than being replaced by that base fallback.
      if (
        view !== 'desktop' &&
        view !== clipboard.device &&
        !original.devices?.[view] &&
        w.placement
      )
        continue
      const positionedDestination = destination.some(
        (other) =>
          surface(other) === surface(w) &&
          (view === 'desktop' ? other.placement : other.devices?.[view] || other.placement),
      )
      if (!p && positionedDestination) {
        const resolved = {
          ...(view === clipboard.device ? clipboard.positions[w.id] : fallback.get(w.id))!,
        }
        if (view === 'desktop') w.placement = resolved
        else w.devices = { ...w.devices, [view]: resolved }
      }
    }
  }
  const authored = roots
    .flatMap((w) => [w.placement, w.devices?.tablet, w.devices?.phone])
    .filter((p): p is Placement => !!p)
  if (authored.length) {
    // A single delta preserves every group's offsets across all authored device
    // views. Children keep parent-local coordinates and are never translated.
    const minX = Math.max(...authored.map((p) => -p.x))
    const maxX = Math.min(...authored.map((p) => 24 - p.x - p.w))
    const minY = Math.max(...authored.map((p) => -p.y))
    const maxY = Math.min(...authored.map((p) => 1000 - p.y - p.h))
    if (![minX, maxX, minY, maxY].every(Number.isFinite) || minX > maxX || minY > maxY)
      throw Error('The copied widgets do not fit within the canvas bounds.')
    const views: ClipboardDevice[] = [
      ...new Set<ClipboardDevice>([
        'desktop',
        device,
        ...(roots.some((w) => w.devices?.tablet) ? ['tablet' as const] : []),
        ...(roots.some((w) => w.devices?.phone) ? ['phone' as const] : []),
      ]),
    ]
    const occupied = new Map(
      views.map((view) => {
        const positions = footprints(destination, view)
        if (view === device)
          destination.forEach((w, i) => {
            if (measured[i]) positions.set(w.id, measured[i]!)
          })
        return [view, positions] as const
      }),
    )
    const same = (a: Placement, b: Placement) =>
      (['x', 'y', 'w', 'h'] as const).every((key) => Math.abs(a[key] - b[key]) < 0.00001)
    const current = roots.map((w) =>
      device === 'desktop' ? w.placement : w.devices?.[device] || w.placement,
    )
    // Anchoring must not silently reparent widgets or turn a flowing surface
    // into a positioned layout. Duplicate omits the anchor altogether.
    const anchored =
      anchor &&
      [anchor.x, anchor.y].every(Number.isFinite) &&
      roots.every((w) => surface(w) === `${anchor.parentId}:${anchor.region}`) &&
      current.every((p): p is Placement => !!p) &&
      destination.some(
        (w) =>
          surface(w) === surface(roots[0]!) &&
          (device === 'desktop' ? w.placement : w.devices?.[device] || w.placement),
      )
    let origin = { x: 0, y: 0 }
    if (anchored) {
      const box = bounds(current as Placement[]),
        primary = current.at(-1)!
      origin = { x: anchor.x - box.x - box.w / 2, y: anchor.y - box.y - box.h / 2 }
      if (spacing.snap !== false)
        origin = {
          x: snap(primary.x + origin.x, spacing.x) - primary.x,
          y: snap(primary.y + origin.y, spacing.y) - primary.y,
        }
      origin.x = Math.max(minX, Math.min(maxX, origin.x))
      origin.y = Math.max(minY, Math.min(maxY, origin.y))
    }
    const seen = new Set<string>()
    let offset: { x: number; y: number } | undefined
    const candidates = anchored ? [{ ...origin }] : []
    for (const [sx, sy] of [
      [1, 1],
      [0, 1],
      [1, 0],
      [-1, -1],
      [0, -1],
      [-1, 0],
      [1, -1],
      [-1, 1],
    ]) {
      for (let step = 1; step <= 32; step++) {
        candidates.push({
          x: origin.x + sx! * step * spacing.x,
          y: origin.y + sy! * step * spacing.y,
        })
      }
    }
    for (const candidate of candidates) {
      const x = Math.max(minX, Math.min(maxX, candidate.x))
      const y = Math.max(minY, Math.min(maxY, candidate.y))
      const key = `${x}:${y}`
      if (seen.has(key)) continue
      seen.add(key)
      const collision = views.some((view) =>
        roots.some((w) => {
          const p = view === 'desktop' ? w.placement : w.devices?.[view] || w.placement
          if (!p) return false
          const moved = { ...p, x: p.x + x, y: p.y + y }
          return destination.some(
            (other) =>
              surface(other) === surface(w) && same(moved, occupied.get(view)!.get(other.id)!),
          )
        }),
      )
      if (!collision) {
        offset = { x, y }
        break
      }
    }
    if (!offset)
      throw Error(
        'No distinct nearby position was found within the canvas bounds. Move a widget and try again.',
      )
    const shifted = (p: Placement) => ({ ...p, x: p.x + offset!.x, y: p.y + offset!.y })
    for (const w of roots) {
      if (w.placement) w.placement = shifted(w.placement)
      if (w.devices?.tablet) w.devices.tablet = shifted(w.devices.tablet)
      if (w.devices?.phone) w.devices.phone = shifted(w.devices.phone)
    }
  }
  const used = new Set([...destination, ...clipboard.widgets].map((w) => w.id))
  const mapping = new Map<string, string>()
  for (const w of copies) {
    let id: string = crypto.randomUUID()
    for (let attempt = 0; used.has(id) && attempt < 8; attempt++) id = crypto.randomUUID()
    if (used.has(id)) throw Error('Could not create unique widget IDs. Try again.')
    used.add(id)
    mapping.set(w.id, id)
  }
  for (const w of copies) {
    if (w.type === 'notes') w.text = ''
    if (!clipboard.roots.includes(w.id) && w.parentId) w.parentId = mapping.get(w.parentId)!
    w.id = mapping.get(w.id)!
  }
  return { widgets: copies, roots: clipboard.roots.map((id) => mapping.get(id)!) }
}
