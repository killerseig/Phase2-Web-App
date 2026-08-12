import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useMeasuredCardScale } from '@/composables/useMeasuredCardScale'

const resizeObserverInstances: FakeResizeObserver[] = []

class FakeResizeObserver {
  readonly callback: ResizeObserverCallback
  readonly observedElements: Element[] = []
  disconnected = false

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    resizeObserverInstances.push(this)
  }

  observe(element: Element) {
    this.observedElements.push(element)
  }

  unobserve(element: Element) {
    const index = this.observedElements.indexOf(element)
    if (index !== -1) {
      this.observedElements.splice(index, 1)
    }
  }

  disconnect() {
    this.disconnected = true
    this.observedElements.splice(0)
  }

  trigger(width: number) {
    this.callback([
      {
        contentRect: { width },
      } as ResizeObserverEntry,
    ], this as unknown as ResizeObserver)
  }
}

function setElementMetrics(
  element: HTMLElement,
  metrics: {
    clientWidth?: number
    offsetWidth?: number
    offsetHeight?: number
  },
) {
  for (const [key, value] of Object.entries(metrics)) {
    Object.defineProperty(element, key, {
      configurable: true,
      value,
    })
  }
}

describe('useMeasuredCardScale', () => {
  beforeEach(() => {
    resizeObserverInstances.length = 0
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns unscaled styles before a card is measured', () => {
    const measurements = useMeasuredCardScale()

    expect(measurements.getCardScaleStyle('card-1')).toEqual({
      transform: 'scale(1)',
    })
    expect(measurements.getCardShellStyle('card-1')).toBeUndefined()
  })

  it('measures shell and content elements, scales to fit, and reacts to resize updates', () => {
    const measurements = useMeasuredCardScale()
    const shell = document.createElement('div')
    const content = document.createElement('div')

    setElementMetrics(shell, { clientWidth: 250 })
    setElementMetrics(content, { offsetWidth: 500, offsetHeight: 800 })

    measurements.setCardShellElement('card-1', shell)
    measurements.setCardContentElement('card-1', content)

    expect(measurements.getCardScaleStyle('card-1')).toEqual({
      transform: 'scale(0.5)',
    })
    expect(measurements.getCardShellStyle('card-1')).toEqual({
      height: '400px',
    })

    setElementMetrics(content, { offsetWidth: 600, offsetHeight: 900 })
    resizeObserverInstances[0]!.trigger(300)
    resizeObserverInstances[1]!.trigger(0)

    expect(measurements.getCardScaleStyle('card-1')).toEqual({
      transform: 'scale(0.5)',
    })
    expect(measurements.getCardShellStyle('card-1')).toEqual({
      height: '450px',
    })
  })

  it('clamps measured scale to the configured max scale', () => {
    const measurements = useMeasuredCardScale(0.75)
    const shell = document.createElement('div')
    const content = document.createElement('div')

    setElementMetrics(shell, { clientWidth: 1000 })
    setElementMetrics(content, { offsetWidth: 500, offsetHeight: 800 })

    measurements.setCardShellElement('card-1', shell)
    measurements.setCardContentElement('card-1', content)

    expect(measurements.getCardScaleStyle('card-1')).toEqual({
      transform: 'scale(0.75)',
    })
    expect(measurements.getCardShellStyle('card-1')).toEqual({
      height: '600px',
    })
  })

  it('disconnects replaced and removed card observers and clears stale measurements', () => {
    const measurements = useMeasuredCardScale()
    const shell = document.createElement('div')
    const nextShell = document.createElement('div')
    const content = document.createElement('div')

    setElementMetrics(shell, { clientWidth: 250 })
    setElementMetrics(nextShell, { clientWidth: 400 })
    setElementMetrics(content, { offsetWidth: 500, offsetHeight: 800 })

    measurements.setCardShellElement('card-1', shell)
    measurements.setCardContentElement('card-1', content)

    const firstShellObserver = resizeObserverInstances[0]!
    const contentObserver = resizeObserverInstances[1]!

    measurements.setCardShellElement('card-1', nextShell)

    expect(firstShellObserver.disconnected).toBe(true)
    expect(measurements.getCardScaleStyle('card-1')).toEqual({
      transform: 'scale(0.8)',
    })

    measurements.setCardContentElement('card-1', null)

    expect(contentObserver.disconnected).toBe(true)
    expect(measurements.getCardScaleStyle('card-1')).toEqual({
      transform: 'scale(1)',
    })
    expect(measurements.getCardShellStyle('card-1')).toBeUndefined()
  })

  it('prunes invalid card measurements while preserving valid cards', () => {
    const measurements = useMeasuredCardScale()
    const validShell = document.createElement('div')
    const validContent = document.createElement('div')
    const staleShell = document.createElement('div')
    const staleContent = document.createElement('div')

    setElementMetrics(validShell, { clientWidth: 250 })
    setElementMetrics(validContent, { offsetWidth: 500, offsetHeight: 800 })
    setElementMetrics(staleShell, { clientWidth: 300 })
    setElementMetrics(staleContent, { offsetWidth: 600, offsetHeight: 900 })

    measurements.setCardShellElement('valid-card', validShell)
    measurements.setCardContentElement('valid-card', validContent)
    measurements.setCardShellElement('stale-card', staleShell)
    measurements.setCardContentElement('stale-card', staleContent)

    const staleShellObserver = resizeObserverInstances[2]!
    const staleContentObserver = resizeObserverInstances[3]!

    measurements.pruneCardMeasurements(new Set(['valid-card']))

    expect(staleShellObserver.disconnected).toBe(true)
    expect(staleContentObserver.disconnected).toBe(true)
    expect(measurements.getCardScaleStyle('valid-card')).toEqual({
      transform: 'scale(0.5)',
    })
    expect(measurements.getCardScaleStyle('stale-card')).toEqual({
      transform: 'scale(1)',
    })
    expect(measurements.getCardShellStyle('stale-card')).toBeUndefined()
  })

  it('clears all measurements and disconnects all observers', () => {
    const measurements = useMeasuredCardScale()
    const shell = document.createElement('div')
    const content = document.createElement('div')

    setElementMetrics(shell, { clientWidth: 250 })
    setElementMetrics(content, { offsetWidth: 500, offsetHeight: 800 })

    measurements.setCardShellElement('card-1', shell)
    measurements.setCardContentElement('card-1', content)
    measurements.clearCardMeasurements()

    expect(resizeObserverInstances.every((observer) => observer.disconnected)).toBe(true)
    expect(measurements.getCardScaleStyle('card-1')).toEqual({
      transform: 'scale(1)',
    })
    expect(measurements.getCardShellStyle('card-1')).toBeUndefined()
  })

  it('passes through real elements and rejects component instances for observed refs', () => {
    const measurements = useMeasuredCardScale()
    const element = document.createElement('div')

    expect(measurements.asObservedElement(element)).toBe(element)
    expect(measurements.asObservedElement({ $el: element } as never)).toBeNull()
    expect(measurements.asObservedElement(null)).toBeNull()
  })
})
