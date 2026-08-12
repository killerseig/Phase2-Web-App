import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useWindowEventListener } from '@/composables/useWindowEventListener'

describe('useWindowEventListener', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers a window listener on mount and removes it on unmount', () => {
    const listener = vi.fn()
    const options = { capture: true }
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const removeEventListener = vi.spyOn(window, 'removeEventListener')
    const Component = defineComponent({
      setup() {
        useWindowEventListener('keydown', listener, options)
        return () => null
      },
    })

    const wrapper = mount(Component)

    expect(addEventListener).toHaveBeenCalledWith('keydown', listener, options)
    expect(removeEventListener).not.toHaveBeenCalled()

    wrapper.unmount()

    expect(removeEventListener).toHaveBeenCalledWith('keydown', listener, options)
  })

  it('keeps native window event behavior intact while mounted', () => {
    const listener = vi.fn()
    const Component = defineComponent({
      setup() {
        useWindowEventListener('resize', listener)
        return () => null
      },
    })

    const wrapper = mount(Component)

    window.dispatchEvent(new Event('resize'))

    expect(listener).toHaveBeenCalledTimes(1)

    wrapper.unmount()
    window.dispatchEvent(new Event('resize'))

    expect(listener).toHaveBeenCalledTimes(1)
  })
})
