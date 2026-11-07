export interface CameraPoint {
  x: number
  y: number
}

export interface EditorBounds extends CameraPoint {
  width: number
  height: number
}

/** One-shot editor fit. Its scale is independent of saved/runtime zoom limits. */
export function fitEditorBounds(bounds: EditorBounds, width: number, height: number, padding = 24) {
  if (
    ![bounds.x, bounds.y, bounds.width, bounds.height, width, height, padding].every(
      Number.isFinite,
    ) ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    width <= 0 ||
    height <= 0 ||
    padding < 0
  )
    return undefined
  return {
    scale: Math.min(
      1,
      Math.max(1, width - 2 * padding) / bounds.width,
      Math.max(1, height - 2 * padding) / bounds.height,
    ),
    center: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
  }
}

/** Root widgets are measured in logical pixels; nested children belong to their container. */
export function contentFitBounds(
  rects: EditorBounds[],
  columnWidth: number,
  rowHeight = 32,
): EditorBounds | undefined {
  const visible = rects.filter(
    (r) => [r.x, r.y, r.width, r.height].every(Number.isFinite) && r.width > 0 && r.height > 0,
  )
  if (!visible.length || ![columnWidth, rowHeight].every((n) => Number.isFinite(n) && n > 0))
    return undefined
  // Percentage positions are quantized by browser layout (often to 1/64px).
  // Ignore that sub-pixel error without adding a whole cell at an exact boundary.
  const tolerance = 1 / 16
  const left =
    Math.floor((Math.min(...visible.map((r) => r.x)) + tolerance) / columnWidth) * columnWidth
  const top = Math.floor((Math.min(...visible.map((r) => r.y)) + tolerance) / rowHeight) * rowHeight
  const right =
    Math.ceil((Math.max(...visible.map((r) => r.x + r.width)) - tolerance) / columnWidth) *
    columnWidth
  const bottom =
    Math.ceil((Math.max(...visible.map((r) => r.y + r.height)) - tolerance) / rowHeight) * rowHeight
  return {
    x: left,
    y: top,
    width: Math.max(columnWidth, right - left),
    height: Math.max(rowHeight, bottom - top),
  }
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
