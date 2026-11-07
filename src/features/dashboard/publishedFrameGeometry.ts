import type { DashboardPublishedFrame } from '../../../functions/src/sharedDashboardModel'
import type { Direction } from './editorGeometry'

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
const rounded = (n: number) => Math.round(n * 100) / 100

/** Move/resize a display window without reflowing its authored content. */
export function transformPublishedFrame(
  frame: DashboardPublishedFrame,
  action: 'move' | Direction,
  dx: number,
  dy: number,
  spacing = { x: 1, y: 1 },
): DashboardPublishedFrame {
  if (![dx, dy, spacing.x, spacing.y].every(Number.isFinite) || spacing.x <= 0 || spacing.y <= 0)
    return { ...frame }
  const snap = (n: number, step: number) => rounded(Math.round(n / step) * step)
  if (action === 'move')
    return {
      ...frame,
      x: dx ? clamp(snap(frame.x + dx, spacing.x), -10000, 10000) : frame.x,
      y: dy ? clamp(snap(frame.y + dy, spacing.y), -10000, 10000) : frame.y,
    }
  const result = { ...frame }
  if (dx && action.includes('w')) {
    result.x = clamp(
      snap(frame.x + dx, spacing.x),
      Math.max(-10000, frame.x + frame.width - 3840),
      Math.min(10000, frame.x + frame.width - 320),
    )
    result.width = rounded(frame.x + frame.width - result.x)
  } else if (dx && action.includes('e')) {
    result.width = clamp(rounded(snap(frame.x + frame.width + dx, spacing.x) - frame.x), 320, 3840)
  }
  if (dy && action.includes('n')) {
    result.y = clamp(
      snap(frame.y + dy, spacing.y),
      Math.max(-10000, frame.y + frame.height - 4000),
      Math.min(10000, frame.y + frame.height - 240),
    )
    result.height = rounded(frame.y + frame.height - result.y)
  } else if (dy && action.includes('s')) {
    result.height = clamp(
      rounded(snap(frame.y + frame.height + dy, spacing.y) - frame.y),
      240,
      4000,
    )
  }
  return result
}
