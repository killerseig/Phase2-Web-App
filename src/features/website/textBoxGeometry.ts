import type { TextBox } from '../../../functions/src/websiteTextBox'
import type { ResizeDirection } from './grid'

/** Preview zoom and transformed containers, excluding the element's own rotation. */
export function elementViewportTransform(element: HTMLElement) {
  const preview = element.closest<HTMLElement>('.preview-frame')
  let scale = preview ? preview.getBoundingClientRect().width / preview.offsetWidth : 1
  let angle = 0
  for (let parent = element.parentElement; parent && parent !== preview; parent = parent.parentElement) {
    const transform = getComputedStyle(parent).transform
    if (transform && transform !== 'none') {
      const matrix = new DOMMatrixReadOnly(transform)
      angle += Math.atan2(matrix.b, matrix.a)
      scale *= Math.hypot(matrix.a, matrix.b)
    }
  }
  return { scale, angle }
}

/** Both pointer and keyboard resize keep the opposite edge/corner anchored. */
export function resizeTextBox(
  origin: TextBox, width: number, height: number, dx: number, dy: number,
  action: ResizeDirection, lockAspect: boolean, precision = 2,
): TextBox {
  const clamp = (value: number, min = -4000, max = 4000) =>
    Number(Math.max(min, Math.min(max, value)).toFixed(precision))
  const angle = ((origin.rotation || 0) * Math.PI) / 180,
    c = Math.cos(angle), s = Math.sin(angle)
  const horizontal = action.includes('left') ? -1 : action.includes('right') ? 1 : 0
  const vertical = action.includes('top') ? -1 : action.includes('bottom') ? 1 : 0
  let nextWidth = horizontal ? clamp(width + horizontal * (c * dx + s * dy), 24) : width
  let nextHeight = vertical ? clamp(height + vertical * (-s * dx + c * dy), 24) : height
  if (horizontal && vertical && lockAspect) {
    const ratio = width / Math.max(1, height)
    const factor = Math.abs(nextWidth / width - 1) >= Math.abs(nextHeight / height - 1)
      ? nextWidth / width : nextHeight / height
    const bounded = Math.max(24 / width, 24 / height, Math.min(factor, 4000 / width, 4000 / height))
    nextWidth = clamp(width * bounded, 24)
    nextHeight = clamp(nextWidth / ratio, 24)
  }
  const shiftX = horizontal * (nextWidth - width) / 2
  const shiftY = vertical * (nextHeight - height) / 2
  return {
    ...origin,
    ...(horizontal || origin.width !== undefined ? { width: nextWidth } : {}),
    ...(vertical || origin.height !== undefined ? { height: nextHeight } : {}),
    x: clamp((origin.x || 0) + c * shiftX - s * shiftY - (nextWidth - width) / 2),
    y: clamp((origin.y || 0) + s * shiftX + c * shiftY - (nextHeight - height) / 2),
  }
}
