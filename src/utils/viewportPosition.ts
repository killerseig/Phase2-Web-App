export interface ViewportFloatingPositionOptions {
  x: number
  y: number
  elementWidth: number
  elementHeight: number
  viewportWidth: number
  viewportHeight: number
  margin?: number
}

export function getViewportFloatingPosition(options: ViewportFloatingPositionOptions) {
  const margin = options.margin ?? 12

  return {
    x: Math.min(options.x, options.viewportWidth - options.elementWidth - margin),
    y: Math.min(options.y, options.viewportHeight - options.elementHeight - margin),
  }
}
