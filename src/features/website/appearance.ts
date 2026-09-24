import type { CSSProperties } from 'vue'
import type { WidgetAppearance } from './types'
import { GRID_COLUMN, GRID_ROW, type WidgetGeometry } from './grid'

export const appearanceNumbers = [
  { key: 'padding', label: 'Padding (px)', min: 0, max: 160 },
  { key: 'paddingTop', label: 'Padding top (px)', min: 0, max: 160 },
  { key: 'paddingRight', label: 'Padding right (px)', min: 0, max: 160 },
  { key: 'paddingBottom', label: 'Padding bottom (px)', min: 0, max: 160 },
  { key: 'paddingLeft', label: 'Padding left (px)', min: 0, max: 160 },
  { key: 'margin', label: 'Margin (px)', min: 0, max: 160 },
  { key: 'marginTop', label: 'Margin top (px)', min: 0, max: 160 },
  { key: 'marginRight', label: 'Margin right (px)', min: 0, max: 160 },
  { key: 'marginBottom', label: 'Margin bottom (px)', min: 0, max: 160 },
  { key: 'marginLeft', label: 'Margin left (px)', min: 0, max: 160 },
  { key: 'fontSize', label: 'Text size (px)', min: 10, max: 100 },
  { key: 'headingSize', label: 'Heading size (px)', min: 12, max: 160 },
  { key: 'borderWidth', label: 'Border width (px)', min: 0, max: 24 },
  { key: 'radius', label: 'Corner radius (px)', min: 0, max: 160 },
  { key: 'opacity', label: 'Opacity (%)', min: 0, max: 100 },
  { key: 'rotation', label: 'Rotation (degrees)', min: -180, max: 180 },
] as const
export function appearanceStyle(value: WidgetAppearance = {}): CSSProperties {
  const px = (n?: number) => (n === undefined ? undefined : `${n}px`)
  return {
    backgroundColor: value.background,
    color: value.color,
    borderColor: value.borderColor,
    borderWidth: px(value.borderWidth),
    borderRadius: px(value.radius),
    padding: px(value.padding),
    paddingTop: px(value.paddingTop ?? value.padding),
    paddingRight: px(value.paddingRight ?? value.padding),
    paddingBottom: px(value.paddingBottom ?? value.padding),
    paddingLeft: px(value.paddingLeft ?? value.padding),
    margin: px(value.margin),
    marginTop: px(value.marginTop ?? value.margin),
    marginRight: px(value.marginRight ?? value.margin),
    marginBottom: px(value.marginBottom ?? value.margin),
    marginLeft: px(value.marginLeft ?? value.margin),
    '--widget-margin-top': px(value.marginTop ?? value.margin ?? 0),
    '--widget-margin-right': px(value.marginRight ?? value.margin ?? 0),
    '--widget-margin-bottom': px(value.marginBottom ?? value.margin ?? 0),
    '--widget-margin-left': px(value.marginLeft ?? value.margin ?? 0),
    fontSize: px(value.fontSize),
    fontFamily: value.fontFamily
      ? {
          sans: "'Source Sans 3', 'Segoe UI', sans-serif",
          serif: 'Georgia, serif',
          mono: 'Consolas, monospace',
        }[value.fontFamily]
      : undefined,
    textAlign: value.textAlign,
    '--widget-font': value.fontFamily
      ? {
          sans: "'Source Sans 3', 'Segoe UI', sans-serif",
          serif: 'Georgia, serif',
          mono: 'Consolas, monospace',
        }[value.fontFamily]
      : undefined,
    '--heading-size': px(value.headingSize),
    '--image-fit': value.imageFit,
  }
}
export function rotationStyle(value: WidgetAppearance = {}): CSSProperties {
  return { transform: value.rotation ? `rotate(${value.rotation}deg)` : undefined }
}
// Include rotated right/bottom corners in the scrollable and published canvas extent.
export function visualGeometry(layout: WidgetGeometry, rotation = 0): WidgetGeometry {
  if (!rotation) return layout
  const angle = (rotation * Math.PI) / 180
  const width = layout.w * GRID_COLUMN,
    height = layout.h * GRID_ROW
  const w = Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle))
  const h = Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle))
  const left = layout.x * GRID_COLUMN + (width - w) / 2
  const top = layout.y * GRID_ROW + (height - h) / 2
  return {
    ...layout,
    x: Math.max(0, left) / GRID_COLUMN,
    y: Math.max(0, top) / GRID_ROW,
    w: (w + Math.min(0, left)) / GRID_COLUMN,
    h: (h + Math.min(0, top)) / GRID_ROW,
  }
}
