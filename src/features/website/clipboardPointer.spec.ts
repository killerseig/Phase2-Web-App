import { afterEach, describe, expect, it } from 'vitest'
import { captureWebsitePastePoint } from './clipboardPointer'

afterEach(() => document.body.replaceChildren())

function setup(scale = 1) {
  const clip = document.createElement('div'), surface = document.createElement('div')
  clip.append(surface); document.body.append(clip)
  let width = 1080, current = true
  let rect = new DOMRect(100, 50, width * scale, 1000 * scale)
  let clipRect = new DOMRect(90, 40, width * scale + 20, 800 * scale)
  Object.defineProperty(surface, 'offsetWidth', { get: () => width })
  surface.getBoundingClientRect = () => rect
  clip.getBoundingClientRect = () => clipRect
  function capture(x = 100 + 90 * scale, y = 50 + 96 * scale, target: Node = surface) {
    const event = new MouseEvent('contextmenu', { clientX: x, clientY: y })
    Object.defineProperty(event, 'target', { value: target })
    return captureWebsitePastePoint(event, surface, [clip], () => current)
  }
  return { surface, clip, capture, move: () => { rect = new DOMRect(101, 50, rect.width, rect.height) },
    clipResize: () => { clipRect = new DOMRect(90, 40, clipRect.width, 100) },
    resize: () => { width = 900 }, invalidate: () => { current = false } }
}

describe('website clipboard pointer anchoring', () => {
  it.each([0.5, 1, 2])('converts a visible point at zoom %s to Website grid units', scale => {
    const fixture = setup(scale)
    expect(fixture.capture()?.()).toEqual({ x: 2, y: 3 })
  })
  it.each(['move', 'clipResize', 'resize', 'invalidate'] as const)('discards a stale anchor after %s', change => {
    const fixture = setup(), point = fixture.capture()!
    fixture[change]()
    expect(point()).toBeUndefined()
  })
  it('does not turn an unrelated control or keyboard context-menu position into a canvas anchor', () => {
    const fixture = setup()
    expect(fixture.capture(190, 146, fixture.clip)).toBeUndefined()
    expect(fixture.capture(0, 0)).toBeUndefined()
  })
  it('requires both the surface and visible clip to contain the point', () => {
    const fixture = setup()
    expect(fixture.capture(99, 146)).toBeUndefined()
    expect(fixture.capture(190, 900)).toBeUndefined()
  })
  it('discards a disconnected surface', () => {
    const fixture = setup(), point = fixture.capture()!
    fixture.surface.remove()
    expect(point()).toBeUndefined()
  })
})
