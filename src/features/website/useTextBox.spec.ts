import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateTextBoxes, type TextBox } from '../../../functions/src/websiteTextBox'
import { textBoxEditingKey, textBoxValueKey, type ElementTarget } from './textBox'
import { useTextBox } from './useTextBox'
import { resizeTextBox } from './textBoxGeometry'

const wrappers: VueWrapper[] = []
function fixture(scale = 1, initial: TextBox = { x: 10, y: 20, width: 200, height: 100 }) {
  const target = ref<ElementTarget>({ id: 'hero', field: 'title' })
  const selected = ref<ElementTarget | undefined>(target.value)
  const value = ref(initial)
  const save = vi.fn<(target: ElementTarget, next: TextBox) => void>((_, next) => { value.value = next })
  let box!: ReturnType<typeof useTextBox>
  const Component = defineComponent({ setup() {
    const root = ref<HTMLElement>()
    box = useTextBox(root, target)
    return () => h('div', { class: 'preview-frame' }, h('div', { ref: root, tabindex: 0, style: box.style.value }))
  } })
  const wrapper = mount(Component, { attachTo: document.body, global: { provide: {
    [textBoxValueKey as symbol]: () => value.value,
    [textBoxEditingKey as symbol]: {
      selected, device: ref('desktop'), enabled: () => true,
      select: (next: ElementTarget) => { selected.value = next },
      register: () => () => undefined, save,
    },
  } } })
  wrappers.push(wrapper)
  const preview = wrapper.element as HTMLElement
  const element = preview.firstElementChild as HTMLElement
  Object.defineProperties(preview, {
    offsetWidth: { value: 1000 },
    getBoundingClientRect: { value: () => ({ width: 1000 * scale }) },
  })
  Object.defineProperties(element, {
    offsetWidth: { value: 200 }, offsetHeight: { value: 100 },
    getBoundingClientRect: { value: () => ({ x: 0, y: 0, width: 200 * scale, height: 100 * scale }) },
    setPointerCapture: { value: () => undefined }, hasPointerCapture: { value: () => false },
  })
  return { box, save, value, selected, element }
}
function key(key: string, init: KeyboardEventInit = {}) {
  return new KeyboardEvent('keydown', { key, cancelable: true, ...init })
}
function pointer(type = 'pointerdown', clientX = 0) {
  return Object.assign(new MouseEvent(type, { button: 0, clientX, cancelable: true }), { pointerId: 1, isPrimary: true }) as PointerEvent
}
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()) })

describe('inline element keyboard controls', () => {
  it('keeps an untouched auto-height automatic when resizing a short heading', () => {
    const resized = resizeTextBox({ x: 10, y: 20, width: 200 }, 200, 14, 1, 0, 'right', false)
    expect(resized).toMatchObject({ x: 10, y: 20, width: 201 })
    expect(resized.height).toBeUndefined()
    expect(validateTextBoxes({ title: resized })).toEqual({ title: resized })
  })
  it('keeps an untouched automatic width and validates rotated corner resizing', () => {
    const tall = resizeTextBox({ height: 100 }, 5000, 100, 0, 1, 'bottom', false)
    expect(tall.width).toBeUndefined()
    expect(validateTextBoxes({ title: tall })).toEqual({ title: tall })
    const origin = { x: 10, y: 20, width: 200, height: 100, rotation: 30 }
    const resized = resizeTextBox(origin, 200, 100, 10, 0, 'top-left', true, 12)
    const anchored = (box: TextBox) => {
      const angle = Math.PI / 6, w = box.width!, h = box.height!
      return { x: box.x! + w / 2 + Math.cos(angle) * w / 2 - Math.sin(angle) * h / 2,
        y: box.y! + h / 2 + Math.sin(angle) * w / 2 + Math.cos(angle) * h / 2 }
    }
    expect(anchored(resized).x).toBeCloseTo(anchored(origin).x, 8)
    expect(anchored(resized).y).toBeCloseTo(anchored(origin).y, 8)
    expect(resized.width! / resized.height!).toBeCloseTo(2, 8)
    expect(validateTextBoxes({ title: resized })).toEqual({ title: resized })
  })
  it.each([0.5, 1, 2])('moves exactly one screen pixel with Shift at %sx zoom', scale => {
    const state = fixture(scale)
    state.box.key(key('ArrowRight', { shiftKey: true }))
    expect((state.value.value.x! - 10) * scale).toBeCloseTo(1, 8)
    state.box.key(key('ArrowLeft', { shiftKey: true }))
    expect(state.value.value.x).toBe(10)
    expect(state.value.value.y).toBe(20)
  })
  it('anchors the opposite edge and ignores arrows unrelated to the resize handle', () => {
    const state = fixture()
    state.box.key(key('ArrowRight'), 'left')
    expect(state.value.value).toMatchObject({ x: 11, width: 199, y: 20, height: 100 })
    state.save.mockClear()
    state.box.key(key('ArrowDown'), 'left')
    expect(state.save).not.toHaveBeenCalled()
  })
  it.each([{ isComposing: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }])(
    'leaves composition and modified shortcuts to their owner: %j', init => {
      const state = fixture()
      const event = key('ArrowRight', init)
      state.box.key(event)
      state.box.key(key('Escape', init))
      expect(state.save).not.toHaveBeenCalled()
      expect(event.defaultPrevented).toBe(false)
      expect(state.selected.value).toBeDefined()
    },
  )
  it('does not mutate while a pointer is armed or dragging, and composing Escape does not cancel it', () => {
    const state = fixture()
    state.box.start(pointer())
    state.box.key(key('ArrowDown'))
    expect(state.save).not.toHaveBeenCalled()
    window.dispatchEvent(pointer('pointermove', 12))
    const escape = key('Escape', { isComposing: true })
    window.dispatchEvent(escape)
    expect(escape.defaultPrevented).toBe(false)
    state.box.key(key('ArrowRight'))
    window.dispatchEvent(pointer('pointerup', 12))
    expect(state.save).toHaveBeenCalledTimes(1)
    expect(state.value.value).toMatchObject({ x: 22, y: 20 })
  })
  it('keeps angular Shift rotation at fifteen degrees', () => {
    const state = fixture()
    state.box.key(key('ArrowRight', { shiftKey: true }), 'rotate')
    expect(state.value.value.rotation).toBe(15)
  })
})
