import { describe, expect, it } from 'vitest'
import { transformPublishedFrame } from './publishedFrameGeometry'
import {
  defaultDashboardViewport,
  validateDashboardViewport,
} from '../../../functions/src/sharedDashboardModel'

const frame = { x: -120, y: 64, width: 800, height: 600 }
describe('independent published frame', () => {
  it('keeps legacy viewports unchanged and clones explicit frames', () => {
    const legacy = defaultDashboardViewport()
    expect(validateDashboardViewport(legacy)).toEqual(legacy)
    expect(validateDashboardViewport(legacy)).not.toHaveProperty('publishedFrame')
    const config = { ...legacy, publishedFrame: frame }
    const result = validateDashboardViewport(config)
    expect(result).toEqual(config)
    expect(result.publishedFrame).not.toBe(frame)
  })
  it.each([
    null,
    [],
    {},
    { ...frame, x: Infinity },
    { ...frame, y: NaN },
    { ...frame, x: -10001 },
    { ...frame, y: 10001 },
    { ...frame, width: '800' },
    { ...frame, width: 319 },
    { ...frame, width: 3841 },
    { ...frame, height: 239 },
    { ...frame, height: 4001 },
    { ...frame, owner: 'forged' },
  ])('rejects invalid persisted frame %#', (publishedFrame) => {
    expect(() =>
      validateDashboardViewport({ ...defaultDashboardViewport(), publishedFrame }),
    ).toThrow('Invalid dashboard viewport settings.')
  })
  it('snaps a signed move without resizing or mutating the source', () => {
    expect(transformPublishedFrame(frame, 'move', 41, -100, { x: 45, y: 32 })).toEqual({
      ...frame,
      x: -90,
      y: -32,
    })
    expect(frame).toEqual({ x: -120, y: 64, width: 800, height: 600 })
  })
  it('keeps the opposite corner fixed when north/west edges reach size limits', () => {
    const min = transformPublishedFrame(frame, 'nw', 10000, 10000)
    expect(min).toEqual({ x: 360, y: 424, width: 320, height: 240 })
    const max = transformPublishedFrame(frame, 'nw', -10000, -10000)
    expect(max).toEqual({ x: -3160, y: -3336, width: 3840, height: 4000 })
    expect(transformPublishedFrame(frame, 'se', Infinity, 0)).toEqual(frame)
  })
  it.each(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const)(
    'resizes only the requested %s edges',
    (direction) => {
      const result = transformPublishedFrame(frame, direction, 20, 30)
      expect(result.x + result.width).toBe(direction.includes('e') ? 700 : 680)
      expect(result.y + result.height).toBe(direction.includes('s') ? 694 : 664)
      expect(result.x).toBe(direction.includes('w') ? -100 : -120)
      expect(result.y).toBe(direction.includes('n') ? 94 : 64)
    },
  )
})
