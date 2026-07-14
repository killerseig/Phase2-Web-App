import { computed, reactive } from 'vue'
import { getViewportFloatingPosition } from '@/utils/viewportPosition'

export type ShopCatalogContextMenuTarget =
  | { kind: 'root' }
  | { kind: 'category'; id: string }
  | { kind: 'item'; id: string }

interface UseShopCatalogContextMenuOptions {
  menuWidth?: number
  menuHeight?: number
  touchDelayMs?: number
  touchMoveThreshold?: number
  suppressClickMs?: number
}

const DEFAULT_MENU_WIDTH = 220
const DEFAULT_MENU_HEIGHT = 220
const DEFAULT_TOUCH_DELAY_MS = 700
const DEFAULT_TOUCH_MOVE_THRESHOLD = 10
const DEFAULT_SUPPRESS_CLICK_MS = 700

function isTrackedPointerType(pointerType: string): pointerType is 'mouse' | 'touch' | 'pen' {
  return pointerType === 'mouse' || pointerType === 'touch' || pointerType === 'pen'
}

export function useShopCatalogContextMenu(options: UseShopCatalogContextMenuOptions = {}) {
  const menuWidth = options.menuWidth ?? DEFAULT_MENU_WIDTH
  const menuHeight = options.menuHeight ?? DEFAULT_MENU_HEIGHT
  const touchDelayMs = options.touchDelayMs ?? DEFAULT_TOUCH_DELAY_MS
  const touchMoveThreshold = options.touchMoveThreshold ?? DEFAULT_TOUCH_MOVE_THRESHOLD
  const suppressClickMs = options.suppressClickMs ?? DEFAULT_SUPPRESS_CLICK_MS

  const contextMenu = reactive({
    visible: false,
    x: 0,
    y: 0,
    target: { kind: 'root' } as ShopCatalogContextMenuTarget,
  })

  const longPress = reactive({
    timer: null as number | null,
    suppressTimer: null as number | null,
    pointerId: null as number | null,
    pointerType: '' as '' | 'mouse' | 'touch' | 'pen',
    startX: 0,
    startY: 0,
    contextTarget: null as ShopCatalogContextMenuTarget | null,
    captureElement: null as Element | null,
    moved: false,
    suppressClick: false,
  })

  const shouldBlockDragStart = computed(() => (
    contextMenu.visible
    || longPress.pointerId !== null
    || longPress.suppressClick
    || longPress.pointerType === 'touch'
    || longPress.pointerType === 'pen'
  ))

  function closeContextMenu() {
    contextMenu.visible = false
  }

  function clearLongPressTimer() {
    if (longPress.timer !== null) {
      window.clearTimeout(longPress.timer)
      longPress.timer = null
    }
  }

  function clearSuppressTimer() {
    if (longPress.suppressTimer !== null) {
      window.clearTimeout(longPress.suppressTimer)
      longPress.suppressTimer = null
    }
  }

  function releaseLongPressCapture(pointerId?: number) {
    if (!(longPress.captureElement instanceof Element) || pointerId == null) return

    if (typeof longPress.captureElement.hasPointerCapture === 'function' && longPress.captureElement.hasPointerCapture(pointerId)) {
      try {
        longPress.captureElement.releasePointerCapture(pointerId)
      } catch {
        // Ignore browsers that reject late pointer capture release.
      }
    }
  }

  function setSuppressClickWindow(duration = suppressClickMs) {
    longPress.suppressClick = true
    clearSuppressTimer()
    longPress.suppressTimer = window.setTimeout(() => {
      longPress.suppressClick = false
      longPress.suppressTimer = null
    }, duration)
  }

  function resetLongPress(pointerId?: number) {
    if (pointerId != null && longPress.pointerId !== pointerId) return

    clearLongPressTimer()
    releaseLongPressCapture(pointerId ?? longPress.pointerId ?? undefined)
    longPress.pointerId = null
    longPress.pointerType = ''
    longPress.contextTarget = null
    longPress.captureElement = null
    longPress.moved = false
  }

  function openContextMenuAt(target: ShopCatalogContextMenuTarget, clientX: number, clientY: number) {
    const position = getViewportFloatingPosition({
      x: clientX,
      y: clientY,
      elementWidth: menuWidth,
      elementHeight: menuHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    })

    contextMenu.x = position.x
    contextMenu.y = position.y
    contextMenu.target = target
    contextMenu.visible = true
  }

  function openContextMenu(event: MouseEvent, target: ShopCatalogContextMenuTarget) {
    event.preventDefault()
    event.stopPropagation()
    openContextMenuAt(target, event.clientX, event.clientY)
  }

  function hasMovedBeyondTouchThreshold(clientX: number, clientY: number) {
    const movedX = Math.abs(clientX - longPress.startX)
    const movedY = Math.abs(clientY - longPress.startY)
    return movedX > touchMoveThreshold || movedY > touchMoveThreshold
  }

  function beginLongPress(event: PointerEvent, target: ShopCatalogContextMenuTarget) {
    longPress.pointerType = isTrackedPointerType(event.pointerType) ? event.pointerType : ''

    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return

    resetLongPress()
    clearLongPressTimer()
    longPress.pointerId = event.pointerId
    longPress.startX = event.clientX
    longPress.startY = event.clientY
    longPress.contextTarget = target
    longPress.captureElement = event.currentTarget instanceof Element ? event.currentTarget : null
    longPress.moved = false
    longPress.suppressClick = false

    if (typeof longPress.captureElement?.setPointerCapture === 'function') {
      try {
        longPress.captureElement.setPointerCapture(event.pointerId)
      } catch {
        // Ignore browsers that reject pointer capture for this element.
      }
    }

    longPress.timer = window.setTimeout(() => {
      const menuTarget = longPress.contextTarget
      longPress.timer = null

      if (!menuTarget || longPress.moved) return

      setSuppressClickWindow()
      resetLongPress(event.pointerId)
      openContextMenuAt(menuTarget, event.clientX, event.clientY)
    }, touchDelayMs)
  }

  function handleLongPressMove(event: PointerEvent) {
    if (longPress.pointerId !== event.pointerId) return
    if (!hasMovedBeyondTouchThreshold(event.clientX, event.clientY)) return

    longPress.moved = true
    clearLongPressTimer()
  }

  function handleLongPressEnd(event: PointerEvent) {
    if (longPress.pointerId !== event.pointerId) return
    resetLongPress(event.pointerId)
  }

  function consumeSuppressedClick(event: MouseEvent) {
    if (!longPress.suppressClick) return false

    event.preventDefault()
    event.stopPropagation()
    longPress.suppressClick = false
    clearSuppressTimer()
    return true
  }

  function clearPointerType() {
    longPress.pointerType = ''
  }

  function disposeContextMenu() {
    clearLongPressTimer()
    clearSuppressTimer()
    releaseLongPressCapture(longPress.pointerId ?? undefined)
  }

  return {
    clearPointerType,
    closeContextMenu,
    consumeSuppressedClick,
    contextMenu,
    disposeContextMenu,
    beginLongPress,
    handleLongPressEnd,
    handleLongPressMove,
    openContextMenu,
    shouldBlockDragStart,
  }
}
