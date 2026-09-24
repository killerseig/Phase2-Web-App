import { describe, expect, it } from 'vitest'
import { alignMove, rotationAssist } from './alignment'

describe('gentle alignment assistance', () => {
  it('lets slow rotation reach 98 degrees and snaps a quick approach to 90', () => {
    expect(rotationAssist(96, 0).update(98, 1000)).toEqual({ angle: 98, snapped: false })
    const fast = rotationAssist(0, 0)
    expect(fast.update(98, 150)).toEqual({ angle: 90, snapped: true })
    expect(fast.update(98, 1000)).toEqual({ angle: 90, snapped: true })
    expect(fast.update(98.2, 1200)).toEqual({ angle: 98.2, snapped: false })
  })
  it('limits automatic attraction, supports precision override and crosses the angle seam', () => {
    expect(rotationAssist(0, 0).update(102, 100).angle).toBe(102)
    expect(rotationAssist(0, 0).update(98, 100, false, true).angle).toBe(98)
    expect(rotationAssist(96, 0).update(98, 1000, true).angle).toBe(105)
    expect(rotationAssist(179, 0).update(-179, 1000).angle).toBe(-179)
    expect(rotationAssist(170, 0).update(-179, 30).angle).toBe(-180)
  })
  it('finds the nearest edges and centers with a small screen-space tolerance', () => {
    const moving = { left: 97, top: 20, width: 20, height: 20 }
    const peer = { left: 100, top: 70, width: 20, height: 20 }
    const result = alignMove(moving, [peer])
    expect(result.x).toBe(3)
    expect(result.y).toBe(0)
    expect(result.guides[0]).toEqual({ axis: 'x', at: 100, from: 20, to: 90 })
    expect(alignMove(moving, [peer], false).x).toBe(0)
    expect(alignMove(moving, [peer], false).guides).toEqual(result.guides)
    expect(alignMove({ ...moving, left: 40 }, [peer]).guides).toEqual([])
  })
})
