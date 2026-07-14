import { reactive, type ComponentPublicInstance } from 'vue'

interface MeasuredContentSize {
  width: number
  height: number
}

export function useMeasuredCardScale(maxScale = 1) {
  const shellWidths = reactive<Record<string, number>>({})
  const contentSizes = reactive<Record<string, MeasuredContentSize>>({})
  const shellObservers = new Map<string, ResizeObserver>()
  const contentObservers = new Map<string, ResizeObserver>()

  function clearRecord<T>(stateMap: Record<string, T>) {
    Object.keys(stateMap).forEach((key) => {
      delete stateMap[key]
    })
  }

  function disconnectCardMeasurements() {
    shellObservers.forEach((observer) => observer.disconnect())
    contentObservers.forEach((observer) => observer.disconnect())
    shellObservers.clear()
    contentObservers.clear()
  }

  function clearCardMeasurements() {
    disconnectCardMeasurements()
    clearRecord(shellWidths)
    clearRecord(contentSizes)
  }

  function pruneCardMeasurements(validIds: Set<string>) {
    Object.keys(shellWidths).forEach((cardId) => {
      if (!validIds.has(cardId)) delete shellWidths[cardId]
    })

    Object.keys(contentSizes).forEach((cardId) => {
      if (!validIds.has(cardId)) delete contentSizes[cardId]
    })

    Array.from(shellObservers.keys()).forEach((cardId) => {
      if (!validIds.has(cardId)) {
        shellObservers.get(cardId)?.disconnect()
        shellObservers.delete(cardId)
      }
    })

    Array.from(contentObservers.keys()).forEach((cardId) => {
      if (!validIds.has(cardId)) {
        contentObservers.get(cardId)?.disconnect()
        contentObservers.delete(cardId)
      }
    })
  }

  function setCardShellElement(cardId: string, element: Element | null) {
    shellObservers.get(cardId)?.disconnect()
    shellObservers.delete(cardId)

    if (!(element instanceof HTMLElement)) {
      delete shellWidths[cardId]
      return
    }

    shellWidths[cardId] = element.clientWidth
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return

      const nextWidth = entry.contentRect.width
      if (shellWidths[cardId] === nextWidth) return
      shellWidths[cardId] = nextWidth
    })

    observer.observe(element)
    shellObservers.set(cardId, observer)
  }

  function setCardContentElement(cardId: string, element: Element | null) {
    contentObservers.get(cardId)?.disconnect()
    contentObservers.delete(cardId)

    if (!(element instanceof HTMLElement)) {
      delete contentSizes[cardId]
      return
    }

    const updateSize = () => {
      const width = element.offsetWidth
      const height = element.offsetHeight
      const current = contentSizes[cardId]
      if (current?.width === width && current.height === height) return
      contentSizes[cardId] = { width, height }
    }

    updateSize()
    const observer = new ResizeObserver(() => {
      updateSize()
    })

    observer.observe(element)
    contentObservers.set(cardId, observer)
  }

  function asObservedElement(
    element: Element | ComponentPublicInstance | null,
  ): Element | null {
    return element instanceof Element ? element : null
  }

  function getCardScale(cardId: string) {
    const shellWidth = shellWidths[cardId] ?? 0
    const contentWidth = contentSizes[cardId]?.width ?? 0
    if (!shellWidth || !contentWidth) return 1
    return Math.min(maxScale, shellWidth / contentWidth)
  }

  function getCardShellStyle(cardId: string) {
    const scale = getCardScale(cardId)
    const contentHeight = contentSizes[cardId]?.height ?? 0
    if (!contentHeight) return undefined
    return {
      height: `${contentHeight * scale}px`,
    }
  }

  function getCardScaleStyle(cardId: string) {
    const scale = getCardScale(cardId)
    return {
      transform: `scale(${scale})`,
    }
  }

  return {
    asObservedElement,
    clearCardMeasurements,
    disconnectCardMeasurements,
    getCardScaleStyle,
    getCardShellStyle,
    pruneCardMeasurements,
    setCardContentElement,
    setCardShellElement,
  }
}
