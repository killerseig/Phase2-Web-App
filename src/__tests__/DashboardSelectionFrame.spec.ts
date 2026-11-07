import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import DashboardSelectionFrame from '@/components/dashboard/DashboardSelectionFrame.vue'

afterEach(() => vi.restoreAllMocks())
describe('selection controls in clipped containers', () => {
  it.each([
    { left: 35, right: 34, top: 0, bottom: 100 },
    { left: 0, right: 100, top: 35, bottom: 34 },
    { left: 35, right: 35, top: 0, bottom: 100 },
  ])(
    'removes controls from keyboard/accessibility when the clip intersection is empty %#',
    async (clipBounds) => {
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
        left: 20,
        right: 44,
        top: 20,
        bottom: 44,
        width: 24,
        height: 24,
        x: 20,
        y: 20,
        toJSON: () => ({}),
      })
      const wrapper = mount(DashboardSelectionFrame, {
        attachTo: document.body,
        props: { geometry: { x: 0, y: 0, w: 6, h: 8 } },
      })
      try {
        const move = wrapper.get('button[data-selection-control="move"]')
        ;(move.element as HTMLElement).focus()
        await wrapper.setProps({ clipBounds })
        await nextTick()
        expect(wrapper.emitted('focus-hidden')).toHaveLength(1)
        for (const button of wrapper.findAll('button')) {
          expect(button.attributes('inert')).toBeDefined()
          expect(button.attributes('aria-hidden')).toBe('true')
        }
        await wrapper.setProps({ clipBounds: undefined })
        await nextTick()
        for (const button of wrapper.findAll('button')) {
          expect(button.attributes('inert')).toBeUndefined()
          expect(button.attributes('aria-hidden')).toBeUndefined()
        }
      } finally {
        wrapper.unmount()
      }
    },
  )
})
