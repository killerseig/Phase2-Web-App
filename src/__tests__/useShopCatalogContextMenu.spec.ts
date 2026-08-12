import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  type ShopCatalogContextMenuTarget,
  useShopCatalogContextMenu,
} from '@/features/shopCatalog/useShopCatalogContextMenu'

const ORIGINAL_VIEWPORT = {
  width: window.innerWidth,
  height: window.innerHeight,
}

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: height,
  })
}

function restoreViewport() {
  setViewport(ORIGINAL_VIEWPORT.width, ORIGINAL_VIEWPORT.height)
}

function mouseEvent(options: MouseEventInit = {}) {
  return new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: 40,
    clientY: 50,
    ...options,
  })
}

function pointerEvent(options: {
  clientX?: number
  clientY?: number
  currentTarget?: Element | null
  pointerId?: number
  pointerType?: string
} = {}) {
  return {
    clientX: options.clientX ?? 40,
    clientY: options.clientY ?? 50,
    currentTarget: options.currentTarget ?? null,
    pointerId: options.pointerId ?? 1,
    pointerType: options.pointerType ?? 'touch',
  } as PointerEvent
}

function target(kind: ShopCatalogContextMenuTarget['kind']): ShopCatalogContextMenuTarget {
  if (kind === 'category') return { kind, id: 'cat-tools' }
  if (kind === 'item') return { kind, id: 'item-drill' }
  return { kind }
}

function captureElement() {
  const element = document.createElement('button')
  element.setPointerCapture = vi.fn()
  element.hasPointerCapture = vi.fn(() => true)
  element.releasePointerCapture = vi.fn()
  return element
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  restoreViewport()
})

describe('useShopCatalogContextMenu', () => {
  it('opens a context menu at the event point and prevents the browser menu', () => {
    setViewport(600, 400)
    const menu = useShopCatalogContextMenu({ menuWidth: 100, menuHeight: 80 })
    const event = mouseEvent({ clientX: 120, clientY: 140 })
    const preventDefault = vi.spyOn(event, 'preventDefault')
    const stopPropagation = vi.spyOn(event, 'stopPropagation')

    menu.openContextMenu(event, target('category'))

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(stopPropagation).toHaveBeenCalledTimes(1)
    expect(menu.contextMenu).toMatchObject({
      visible: true,
      x: 120,
      y: 140,
      target: { kind: 'category', id: 'cat-tools' },
    })
  })

  it('clamps the menu position inside the viewport margin', () => {
    setViewport(500, 400)
    const menu = useShopCatalogContextMenu({ menuWidth: 100, menuHeight: 80 })

    menu.openContextMenu(mouseEvent({ clientX: 490, clientY: 390 }), target('item'))

    expect(menu.contextMenu).toMatchObject({
      visible: true,
      x: 388,
      y: 308,
      target: { kind: 'item', id: 'item-drill' },
    })
  })

  it('closes the current menu without clearing the selected target', () => {
    const menu = useShopCatalogContextMenu()
    menu.openContextMenu(mouseEvent(), target('item'))

    menu.closeContextMenu()

    expect(menu.contextMenu.visible).toBe(false)
    expect(menu.contextMenu.target).toEqual({ kind: 'item', id: 'item-drill' })
  })

  it('opens a touch long-press menu after the delay and suppresses the next click', () => {
    vi.useFakeTimers()
    setViewport(500, 400)
    const element = captureElement()
    const menu = useShopCatalogContextMenu({
      menuWidth: 100,
      menuHeight: 80,
      touchDelayMs: 25,
      suppressClickMs: 50,
    })

    menu.beginLongPress(pointerEvent({
      clientX: 490,
      clientY: 390,
      currentTarget: element,
      pointerId: 7,
      pointerType: 'touch',
    }), target('root'))

    expect(element.setPointerCapture).toHaveBeenCalledWith(7)
    expect(menu.shouldBlockDragStart.value).toBe(true)

    vi.advanceTimersByTime(25)

    expect(menu.contextMenu).toMatchObject({
      visible: true,
      x: 388,
      y: 308,
      target: { kind: 'root' },
    })
    expect(element.releasePointerCapture).toHaveBeenCalledWith(7)
    expect(menu.shouldBlockDragStart.value).toBe(true)

    const click = mouseEvent()
    const preventDefault = vi.spyOn(click, 'preventDefault')
    const stopPropagation = vi.spyOn(click, 'stopPropagation')

    expect(menu.consumeSuppressedClick(click)).toBe(true)
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(stopPropagation).toHaveBeenCalledTimes(1)
  })

  it('clears suppressed-click state when the timeout expires', () => {
    vi.useFakeTimers()
    const menu = useShopCatalogContextMenu({ touchDelayMs: 5, suppressClickMs: 10 })

    menu.beginLongPress(pointerEvent(), target('root'))
    vi.advanceTimersByTime(5)
    vi.advanceTimersByTime(10)

    expect(menu.consumeSuppressedClick(mouseEvent())).toBe(false)
  })

  it('cancels a pending long press when the pointer moves past the threshold', () => {
    vi.useFakeTimers()
    const menu = useShopCatalogContextMenu({
      touchDelayMs: 25,
      touchMoveThreshold: 5,
    })

    menu.beginLongPress(pointerEvent({ clientX: 10, clientY: 10, pointerId: 2 }), target('item'))
    menu.handleLongPressMove(pointerEvent({ clientX: 16, clientY: 10, pointerId: 2 }))
    vi.advanceTimersByTime(25)

    expect(menu.contextMenu.visible).toBe(false)
    expect(menu.shouldBlockDragStart.value).toBe(true)

    menu.handleLongPressEnd(pointerEvent({ pointerId: 2 }))

    expect(menu.shouldBlockDragStart.value).toBe(false)
  })

  it('ignores mouse long-press starts and clears tracked pointer type', () => {
    const menu = useShopCatalogContextMenu()

    menu.beginLongPress(pointerEvent({ pointerType: 'mouse' }), target('root'))

    expect(menu.contextMenu.visible).toBe(false)
    expect(menu.shouldBlockDragStart.value).toBe(false)

    menu.beginLongPress(pointerEvent({ pointerType: 'pen' }), target('root'))
    expect(menu.shouldBlockDragStart.value).toBe(true)

    menu.clearPointerType()

    expect(menu.shouldBlockDragStart.value).toBe(true)
  })

  it('disposes pending timers and releases captured pointers', () => {
    vi.useFakeTimers()
    const element = captureElement()
    const menu = useShopCatalogContextMenu({ touchDelayMs: 25 })

    menu.beginLongPress(pointerEvent({
      currentTarget: element,
      pointerId: 9,
    }), target('root'))

    menu.disposeContextMenu()
    vi.advanceTimersByTime(25)

    expect(element.releasePointerCapture).toHaveBeenCalledWith(9)
    expect(menu.contextMenu.visible).toBe(false)
  })
})
