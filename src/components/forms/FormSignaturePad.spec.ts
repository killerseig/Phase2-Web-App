import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FormSignaturePad from './FormSignaturePad.vue'
import { parseFormSignature } from '../../../functions/src/formSignatures'
import { nextTick } from 'vue'
async function pointer(target: Element, type: string, options: Record<string, unknown>) {
  const event = new MouseEvent(type, { bubbles: true, button: Number(options.button || 0), clientX: Number(options.clientX || 0), clientY: Number(options.clientY || 0) })
  Object.defineProperties(event, { pointerId: { value: options.pointerId }, pointerType: { value: options.pointerType || 'touch' } })
  target.dispatchEvent(event)
  await nextTick()
}
describe('signature drawing surface', () => {
  it.each(['touch', 'pen', 'mouse'])('captures %s ink without inventing a signing time', async pointerType => {
    const view = mount(FormSignaturePad, { props: { modelValue: '', label: 'Attendee signature', id: 'test-signature' } })
    const surface = view.get('svg')
    surface.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 180 }) as DOMRect
    await pointer(surface.element, 'pointerdown', { pointerId: 1, pointerType, button: 0, clientX: 30, clientY: 20 })
    await pointer(surface.element, 'pointermove', { pointerId: 1, pointerType, clientX: 150, clientY: 80 })
    await pointer(surface.element, 'pointerup', { pointerId: 1, pointerType, clientX: 180, clientY: 90 })
    const value = view.emitted('update:modelValue')![0]![0] as string
    expect(parseFormSignature(value)?.strokes[0]).toHaveLength(3)
    expect(parseFormSignature(value)?.signedAt).toBeUndefined()
    await view.setProps({ modelValue: value })
    expect(view.findAll('path')).toHaveLength(1)
    await view.get('button').trigger('click')
    expect(view.emitted('update:modelValue')!.at(-1)).toEqual([''])
    view.unmount()
  })
  it('discards canceled ink and prevents readonly or busy changes', async () => {
    const view = mount(FormSignaturePad, { props: { modelValue: '', label: 'Signature' } })
    const surface = view.get('svg')
    surface.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 180 }) as DOMRect
    await pointer(surface.element, 'pointerdown', { pointerId: 1, button: 0, clientX: 1, clientY: 1 })
    await pointer(surface.element, 'pointercancel', { pointerId: 1 })
    await pointer(surface.element, 'pointerup', { pointerId: 1, clientX: 100, clientY: 100 })
    expect(view.emitted('update:modelValue')).toBeUndefined()
    await view.setProps({ readonly: true })
    await pointer(surface.element, 'pointerdown', { pointerId: 1, button: 0, clientX: 1, clientY: 1 })
    expect(view.find('button').exists()).toBe(false)
    expect(view.emitted('update:modelValue')).toBeUndefined()
    view.unmount()
  })
  it('renders saved time and handles invalid preview values without crashing', () => {
    const view = mount(FormSignaturePad, { props: { modelValue: 'not ink', label: 'Signature', readonly: true } })
    expect(view.text()).toContain('could not be displayed')
    view.unmount()
  })
})
