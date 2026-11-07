import { describe, expect, it } from 'vitest'
import { contentFitBounds, fitEditorBounds } from './viewportGeometry'

describe('editor fit camera', () => {
  it('fits both dimensions and retains a translated target center', () => {
    expect(fitEditorBounds({ x: -120, y: 800, width: 600, height: 2400 }, 848, 648)).toEqual({
      scale: 0.25,
      center: { x: 180, y: 2000 },
    })
  })
  it('never upscales small content, and allows a fit below manual/runtime zoom limits', () => {
    expect(fitEditorBounds({ x: 50, y: 80, width: 80, height: 100 }, 848, 648)?.scale).toBe(1)
    expect(fitEditorBounds({ x: 0, y: 0, width: 240, height: 32000 }, 848, 648)?.scale).toBe(
      600 / 32000,
    )
  })
  it.each([0, -1, Infinity, NaN])('rejects invalid extent %s without a camera change', (width) => {
    expect(fitEditorBounds({ x: 0, y: 0, width, height: 100 }, 800, 600)).toBeUndefined()
  })
  it('rounds actual root content outward and excludes invalid/hidden boxes', () => {
    expect(
      contentFitBounds(
        [
          { x: 51, y: 65, width: 400, height: 100 },
          { x: 600, y: 100, width: 100, height: 99 },
          { x: 0, y: 0, width: 0, height: 5000 },
        ],
        40,
      ),
    ).toEqual({ x: 40, y: 64, width: 680, height: 160 })
    expect(contentFitBounds([], 40)).toBeUndefined()
    expect(contentFitBounds([{ x: 0, y: 0, width: NaN, height: 5000 }], 40)).toBeUndefined()
  })
  it('does not invent another grid cell from floating-point measurement noise', () => {
    expect(
      contentFitBounds([{ x: 39.99999999, y: 64.000000001, width: 240.00000001, height: 96 }], 40),
    ).toEqual({ x: 40, y: 64, width: 240, height: 96 })
    expect(contentFitBounds([{ x: 159.984375, y: 96, width: 400, height: 384 }], 40)).toEqual({
      x: 160,
      y: 96,
      width: 400,
      height: 384,
    })
    expect(contentFitBounds([{ x: 159.8, y: 96, width: 400.4, height: 384 }], 40)).toEqual({
      x: 120,
      y: 96,
      width: 480,
      height: 384,
    })
  })
})
