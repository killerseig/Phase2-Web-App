export interface CameraPoint {
  x: number
  y: number
}

/** Saved offsets use dashboard cells; a camera does not change widget geometry. */
export function startCamera(start: CameraPoint, width: number): CameraPoint {
  return { x: (start.x * width) / 24, y: start.y * 32 }
}

export function panCamera(origin: CameraPoint, dx: number, dy: number, scale: number): CameraPoint {
  if (![dx, dy, scale].every(Number.isFinite) || scale <= 0) return { ...origin }
  const x = origin.x - dx / scale,
    y = origin.y - dy / scale
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : { ...origin }
}

export function alignmentOffset(
  available: number,
  content: number,
  align: 'start' | 'center' | 'end',
) {
  return Math.max(0, available - content) * (align === 'center' ? 0.5 : align === 'end' ? 1 : 0)
}
