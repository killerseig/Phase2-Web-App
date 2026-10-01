import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useWebsiteGrid } from './useWebsiteGrid'
import { defaultGrid } from './grid'

afterEach(() => vi.unstubAllGlobals())

describe('live widget alignment', () => {
  it.each([1, 0.5])(
    'aligns before release at scale %s, bypasses with Alt, and commits the preview',
    (scale) => {
      vi.stubGlobal('requestAnimationFrame', () => 1)
      vi.stubGlobal('cancelAnimationFrame', () => {})
      const surface = document.createElement('div')
      Object.defineProperty(surface, 'offsetWidth', { value: 1000 })
      surface.getBoundingClientRect = () => new DOMRect(0, 0, 1000 * scale, 1000 * scale)
      const commit = vi.fn()
      const origin = { x: 100 / 45, y: 100 / 32, w: 40 / 45, h: 40 / 32, z: 1 }
      const scope = effectScope()
      const grid = scope.run(() =>
        useWebsiteGrid({
          surface: () => surface,
          scroller: ref(surface),
          disabled: () => false,
          settings: () => ({ ...defaultGrid(), snap: false }),
          widgets: () => ({ moving: origin, peer: { ...origin, x: 203 / 45, y: 300 / 32 } }),
          commit,
        }),
      )!
      const event = (type: string, x: number, altKey = false) =>
        new PointerEvent(type, {
          pointerId: 1,
          isPrimary: true,
          button: 0,
          clientX: x * scale,
          clientY: (type === 'pointerdown' ? 110 : 130) * scale,
          altKey,
        })
      try {
        surface.addEventListener('pointerdown', (e) => grid.start(e, 'moving', origin))
        surface.dispatchEvent(event('pointerdown', 110))
        window.dispatchEvent(event('pointermove', 210))
        expect(grid.draft.value!.layout.x * 45).toBeCloseTo(203)
        expect(grid.guides.value).toContainEqual(
          expect.objectContaining({ axis: 'x', at: 203 * scale }),
        )
        expect(commit).not.toHaveBeenCalled()

        window.dispatchEvent(event('pointermove', 210, true))
        expect(grid.draft.value!.layout.x * 45).toBeCloseTo(200, 1)
        expect(grid.guides.value).toEqual([])
        window.dispatchEvent(event('pointermove', 280))
        expect(grid.draft.value!.layout.x * 45).toBeCloseTo(270, 1)
        expect(grid.guides.value).toEqual([])

        window.dispatchEvent(event('pointermove', 210))
        const preview = { ...grid.draft.value!.layout }
        window.dispatchEvent(event('pointerup', 210))
        expect(commit.mock.calls[0]![1]).toEqual(preview)
        expect(grid.guides.value).toEqual([])
        expect(grid.draft.value).toBeUndefined()

        surface.dispatchEvent(event('pointerdown', 110))
        window.dispatchEvent(event('pointermove', 210))
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        expect(grid.draft.value).toBeUndefined()
        expect(commit).toHaveBeenCalledTimes(1)
      } finally {
        scope.stop()
      }
    },
  )
})
