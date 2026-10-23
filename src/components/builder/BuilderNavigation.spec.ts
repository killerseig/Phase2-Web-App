import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BuilderSettingsTabs from './BuilderSettingsTabs.vue'
import BuilderPanelSwitcher from './BuilderPanelSwitcher.vue'

describe('shared builder keyboard navigation', () => {
  it('wraps settings tabs, skips unavailable tabs and keeps focus and panel IDs paired', async () => {
    const wrapper = mount(BuilderSettingsTabs, { attachTo: document.body, props: { modelValue: 'form', label: 'Form settings', idPrefix: 'form-settings', tabs: [{ id: 'form', label: 'Form' }, { id: 'field', label: 'Field', disabled: true }, { id: 'output', label: 'Publishing' }], 'onUpdate:modelValue': value => wrapper.setProps({ modelValue: value }) } })
    const tabs = wrapper.findAll('[role="tab"]')
    await tabs[0]!.trigger('keydown', { key: 'ArrowRight' })
    expect(tabs[2]!.attributes('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(tabs[2]!.element)
    expect(tabs[2]!.attributes('aria-controls')).toBe('form-settings-panel-output')
    await tabs[2]!.trigger('keydown', { key: 'ArrowRight' })
    expect(tabs[0]!.attributes('tabindex')).toBe('0')
    await tabs[0]!.trigger('keydown', { key: 'End' }); expect(tabs[2]!.attributes('aria-selected')).toBe('true')
    await tabs[2]!.trigger('keydown', { key: 'Home' }); expect(tabs[0]!.attributes('aria-selected')).toBe('true')
    await wrapper.setProps({ disabled: true }); const count = wrapper.emitted('update:modelValue')!.length
    await tabs[0]!.trigger('keydown', { key: 'ArrowRight' }); expect(wrapper.emitted('update:modelValue')).toHaveLength(count)
    wrapper.unmount()
  })
  it('uses the same panel navigation and focus order with form-specific selection labels', async () => {
    const wrapper = mount(BuilderPanelSwitcher, { attachTo: document.body, props: { modelValue: 'outline' as const, outlineLabel: 'Forms', outlineControls: 'form-library', canvasControls: 'form-canvas-pane', inspectorControls: 'form-inspector', 'onUpdate:modelValue': value => wrapper.setProps({ modelValue: value }) } })
    const buttons = wrapper.findAll('button')
    expect(buttons.map(button => button.text())).toEqual(['Forms', 'Canvas', 'Editor'])
    await buttons[0]!.trigger('keydown', { key: 'ArrowLeft' })
    expect(buttons[2]!.attributes('aria-pressed')).toBe('true'); expect(document.activeElement).toBe(buttons[2]!.element)
    expect(buttons[2]!.attributes('aria-controls')).toBe('form-inspector')
    await buttons[2]!.trigger('keydown', { key: 'Home' }); expect(buttons[0]!.attributes('tabindex')).toBe('0')
    await buttons[0]!.trigger('keydown', { key: 'ArrowRight' }); expect(buttons[1]!.attributes('aria-pressed')).toBe('true')
    await wrapper.setProps({ disabled: true }); const count = wrapper.emitted('update:modelValue')!.length
    await buttons[1]!.trigger('keydown', { key: 'End' }); expect(wrapper.emitted('update:modelValue')).toHaveLength(count)
    wrapper.unmount()
  })
})
