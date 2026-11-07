/** offsetWidth/clientWidth round fractions; preserve them when projecting zoomed canvases. */
export function surfaceGeometry(element: HTMLElement) {
  const style = getComputedStyle(element)
  const px = (value: string) => Number.parseFloat(value) || 0
  const left = px(style.borderLeftWidth),
    right = px(style.borderRightWidth)
  const top = px(style.borderTopWidth)
  const width =
    px(style.width) +
    (style.boxSizing === 'border-box'
      ? 0
      : left + right + px(style.paddingLeft) + px(style.paddingRight))
  const scrollbar = Math.max(0, element.offsetWidth - element.clientWidth - left - right)
  return {
    rect: element.getBoundingClientRect(),
    width: width - left - right - scrollbar,
    scale: element.getBoundingClientRect().width / width,
    left,
    top,
  }
}
