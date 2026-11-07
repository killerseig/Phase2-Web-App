import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useWebsiteGrid } from './useWebsiteGrid'
import { defaultGrid } from './grid'

afterEach(() => vi.unstubAllGlobals())

describe('active website pointer interaction', () => {
  it.each(['move', 'resize', 'pan', 'marquee'] as const)('reports %s before the drag threshold and clears on release/cancel', action => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const surface = document.createElement('div')
    Object.defineProperty(surface, 'offsetWidth', { value: 1080 })
    surface.getBoundingClientRect = () => new DOMRect(0, 0, 1080, 720)
    const commit = vi.fn<Parameters<typeof useWebsiteGrid>[0]['commit']>()
    const scope = effectScope()
    const grid = scope.run(() => useWebsiteGrid({
      surface: () => surface, scroller: ref(surface), disabled: () => false,
      settings: defaultGrid, commit,
    }))!
    const pointer = (type: string) => new PointerEvent(type, { pointerId: 1, isPrimary: true, button: 0, clientX: 100, clientY: 100 })
    surface.addEventListener('pointerdown', event => {
      if (action === 'marquee') grid.startMarquee(event)
      else {
        grid.hand.value = action === 'pan'
        grid.start(event, 'card', { x: 1, y: 1, w: 4, h: 4, z: 1 }, action === 'resize' ? 'bottom-right' : 'move')
      }
    })
    try {
      expect(grid.isInteracting()).toBe(false)
      surface.dispatchEvent(pointer('pointerdown'))
      expect(grid.isInteracting()).toBe(true)
      expect(grid.dragging.value).toBe(false)
      expect(grid.draft.value).toBeUndefined()
      window.dispatchEvent(pointer('pointerup'))
      expect(grid.isInteracting()).toBe(false)
      surface.dispatchEvent(pointer('pointerdown'))
      grid.cancel()
      expect(grid.isInteracting()).toBe(false)
      expect(commit).not.toHaveBeenCalled()
      surface.dispatchEvent(pointer('pointerdown'))
    } finally { scope.stop() }
    expect(grid.isInteracting()).toBe(false)
  })
})

describe('device screen scrolling', () => {
  it.each([1, 0.5])('uses the clipped Design edge at scale %s', (scale) => {
    let tick: FrameRequestCallback | undefined
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      tick = callback
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const workspace = document.createElement('div')
    workspace.getBoundingClientRect = () => new DOMRect(0, 0, 1600, 1000)
    const clip = document.createElement('div')
    clip.getBoundingClientRect = () => new DOMRect(100, 100, 1080 * scale, 720 * scale)
    const viewport = document.createElement('div')
    Object.defineProperty(viewport, 'offsetWidth', { value: 1160 })
    viewport.getBoundingClientRect = () =>
      new DOMRect(100 - 40 * scale, 100 - 40 * scale, 1160 * scale, 800 * scale)
    const surface = document.createElement('div')
    Object.defineProperty(surface, 'offsetWidth', { value: 1080 })
    surface.getBoundingClientRect = () =>
      new DOMRect(100, 100 - viewport.scrollTop * scale, 1080 * scale, 2000 * scale)
    const commit = vi.fn<Parameters<typeof useWebsiteGrid>[0]['commit']>()
    const scope = effectScope()
    const grid = scope.run(() =>
      useWebsiteGrid({
        surface: () => surface,
        scroller: ref(workspace),
        viewport: ref(viewport),
        clip: ref(clip),
        disabled: () => false,
        settings: () => ({ ...defaultGrid(), snap: false }),
        commit,
      }),
    )!
    const pointer = (type: string, y: number) =>
      new PointerEvent(type, {
        pointerId: 1,
        isPrimary: true,
        button: 0,
        clientX: 200,
        clientY: y,
      })
    surface.addEventListener('pointerdown', (event) =>
      grid.start(event, 'moving', { x: 0, y: 0, w: 4, h: 4, z: 1 }),
    )
    try {
      surface.dispatchEvent(pointer('pointerdown', 200))
      const bottom = clip.getBoundingClientRect().bottom
      window.dispatchEvent(pointer('pointermove', bottom - 5))
      const before = viewport.scrollTop
      tick?.(0)
      expect(viewport.scrollTop - before).toBeCloseTo(10 / scale)
      expect(workspace.scrollTop).toBe(0)
      expect(grid.draft.value).toBeDefined()
      // The padded area outside the visible device cannot accept a drop.
      window.dispatchEvent(pointer('pointermove', bottom + 5))
      const after = viewport.scrollTop
      tick?.(0)
      expect(viewport.scrollTop).toBe(after)
      expect(grid.draft.value).toBeUndefined()
      window.dispatchEvent(pointer('pointerup', bottom + 5))
      expect(commit).not.toHaveBeenCalled()
    } finally {
      scope.stop()
    }
  })
})

describe('live widget alignment', () => {
  it.each([1, 0.5])(
    'aligns before release at scale %s, bypasses with Alt, and commits the preview',
    (scale) => {
      vi.stubGlobal('requestAnimationFrame', () => 1)
      vi.stubGlobal('cancelAnimationFrame', () => {})
      const surface = document.createElement('div')
      Object.defineProperty(surface, 'offsetWidth', { value: 1000 })
      surface.getBoundingClientRect = () => new DOMRect(0, 0, 1000 * scale, 1000 * scale)
      const commit = vi.fn<Parameters<typeof useWebsiteGrid>[0]['commit']>()
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
