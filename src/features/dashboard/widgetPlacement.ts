import type { SharedDashboardWidget } from './sharedDashboards'

// Networking uses 24 columns and 32px rows. Positions are independent of zoom.
// Legacy layouts retain their flow layout until a placement is explicitly edited.
export type Placement = NonNullable<SharedDashboardWidget['placement']>
export function placeWidget(x: number, y: number, w: number, h: number, snap = true): Placement {
  const round = (value: number, step: number) => Math.round(value / step) * step
  w = Math.max(2, Math.min(24, w))
  h = Math.max(3, Math.min(100, h))
  return {
    x: +Math.max(0, Math.min(24 - w, round(x, snap ? 1 : 1 / 45))).toFixed(3),
    y: +Math.max(0, Math.min(1000 - h, round(y, snap ? 1 : 1 / 32))).toFixed(3),
    w: +w.toFixed(3), h: +h.toFixed(3),
  }
}
export function fallbackPlacements(widgets: SharedDashboardWidget[]): Placement[] {
  let x = 0, y = 0
  return widgets.map(widget => {
    const w = widget.span * 2
    if (x + w > 24) { x = 0; y += 11 }
    const p = widget.placement || { x, y, w, h: 10 }
    x += w
    return p
  })
}

export function resizeWidget(p: Placement, dx: number, dy: number, snap = true): Placement {
  const round = (value: number, step: number) => Math.round(value / step) * step
  return {
    ...p,
    w: +Math.max(2, Math.min(24 - p.x, round(p.w + dx, snap ? 1 : 1 / 45))).toFixed(3),
    h: +Math.max(3, Math.min(100, 1000 - p.y, round(p.h + dy, snap ? 1 : 1 / 32))).toFixed(3),
  }
}
