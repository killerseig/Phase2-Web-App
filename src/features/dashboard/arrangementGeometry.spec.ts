import { describe, expect, it } from 'vitest'
import { arrange } from './editorGeometry'

describe('exact arrangement geometry', () => {
  const placements = [
    { x: 1.123456, y: 2.123456, w: 3.456789, h: 5.123456 },
    { x: 8.234567, y: 10.234567, w: 4.123456, h: 6.234567 },
    { x: 18.345678, y: 20.345678, w: 5.123456, h: 7.345678 },
  ]
  it('alignment preserves all untouched coordinates and dimensions exactly', () => {
    const result = arrange(placements, 'left', placements[0]!)
    expect(result).toEqual(placements.map((p) => ({ ...p, x: placements[0]!.x })))
  })
  it.each(['horizontal', 'vertical'] as const)(
    'distribution preserves fractional %s endpoints',
    (operation) => {
      const result = arrange(placements, operation, placements[0]!)
      expect(result[0]).toEqual(placements[0])
      expect(result[2]).toEqual(placements[2])
    },
  )
  it('already aligned geometry is an exact no-op', () => {
    const aligned = placements.map((p) => ({ ...p, y: 2.123456 }))
    expect(arrange(aligned, 'top', aligned[0]!)).toEqual(aligned)
  })
})
