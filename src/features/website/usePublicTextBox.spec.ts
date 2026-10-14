import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { textBoxValueKey } from './textBox'
import { useTextBox } from './usePublicTextBox'
describe('public text box layout without editing lifecycle', () => {
  it('keeps published dimensions, translation and rotation while providing no editor gestures', () => {
    const Component = defineComponent({ setup() {
      const box = useTextBox(ref(), ref({ id: 'published', field: 'text' as const }))
      expect(box.enabled.value).toBe(false); expect(box.selected.value).toBe(false)
      expect(box.consumeClick()).toBe(false)
      return () => h('p', { style: box.style.value }, 'Published content')
    } })
    const wrapper = mount(Component, { global: { provide: { [textBoxValueKey as symbol]: () => ({ x: 12, y: 8, width: 200, height: 40, padding: 4, rotation: 15 }) } } })
    expect(wrapper.attributes('style')).toContain('width: 200px')
    expect(wrapper.attributes('style')).toContain('translate(12px, 8px) rotate(15deg)')
    wrapper.unmount()
  })
})
