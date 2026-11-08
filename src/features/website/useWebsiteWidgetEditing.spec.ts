import { computed, effectScope, nextTick, ref, type EffectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWebsiteWidgetEditing } from './useWebsiteWidgetEditing'
import { useWebsiteHistory } from './useWebsiteHistory'
import { newSection, withWebsiteDefaults, type WebsiteSite, type WebsiteDevice } from './types'
import type { ElementTarget } from './textBox'
import { keyboardGeometry, KEYBOARD_GEOMETRY_PRECISION } from './keyboardGeometry'
import { defaultGrid } from './grid'

const scopes: EffectScope[] = []
function fixture() {
  const scope = effectScope(); scopes.push(scope)
  return scope.run(() => {
    const site = ref<WebsiteSite>(withWebsiteDefaults({ name: 'Synthetic', accent: '#174878', pages: [{ id: 'home', chrome: 'widgets', title: 'Home', slug: 'home', description: '', inNavigation: true, sections: [newSection('text'), newSection('text')] }] }))
    const history = useWebsiteHistory(site); history.reset(site.value)
    const page = computed(() => site.value.pages[0]!)
    const selectedSection = ref(''), selectedIds = ref<string[]>([]), selectedText = ref<ElementTarget>()
    const section = computed(() => page.value.sections.find(item => item.id === selectedSection.value))
    const locked = ref(false), device = ref<WebsiteDevice>('desktop'), cancelDrag = vi.fn<() => void>(), focusArrangement = vi.fn<() => void>()
    const editing = useWebsiteWidgetEditing({
      page, section, selectedSection, selectedIds, selectedText, locked, device,
      settingsPanel: ref<'site' | 'page'>('site'), activePane: ref<'outline' | 'preview' | 'inspector'>('preview'),
      designMode: ref(true), geometryEditable: ref(true), history, cancelDrag, focusArrangement,
    })
    return { site, page, selectedSection, selectedIds, selectedText, section, locked, device, history, cancelDrag, focusArrangement, ...editing }
  })!
}
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()) })

describe('Website widget selection and geometry coordination', () => {
  it('retains fractional flow height for precise keyboard controls and one undo', () => {
    const state = fixture(), entry = state.page.value.sections[0]!
    entry.sizing = { height: 100 }
    state.history.reset(state.site.value)
    state.commitGeometry(entry.id, { ...entry.layout!, h: 100.5 / 32 }, undefined, undefined, undefined, true, KEYBOARD_GEOMETRY_PRECISION)
    expect(entry.sizing.height).toBe(100.5)
    state.history.undo()
    expect(state.page.value.sections[0]!.sizing?.height).toBe(100)
    expect(state.history.canUndo.value).toBe(false)
  })
  it('filters invalid selections, synchronizes inspector selection and removes deleted IDs', async () => {
    const state = fixture(), id = state.page.value.sections[0]!.id
    state.selectedText.value = { id, field: 'text' }
    state.setSelection(['absent', id])
    expect(state.selectedIds.value).toEqual([id])
    expect(state.selectedText.value).toBeUndefined()
    state.page.value.sections = []
    await nextTick()
    expect(state.selectedIds.value).toEqual([])
  })
  it('groups selected siblings in one undoable change and exposes the inspector path', async () => {
    const state = fixture(), ids = state.page.value.sections.map(item => item.id)
    state.setSelection(ids)
    expect(state.canGroup.value).toBe(true)
    state.groupWidgets()
    const container = state.section.value!
    expect(container.type).toBe('container')
    expect(state.page.value.sections.filter(item => item.parentId === container.id).map(item => item.id)).toEqual(ids)
    expect(state.selectionPath.value.at(-1)?.id).toBe(container.id)
    state.history.undo()
    expect(state.page.value.sections.map(item => item.id)).toEqual(ids)
    expect(state.page.value.sections.every(item => !item.parentId)).toBe(true)
  })
  it('unwraps a container without deleting children and supports undo', () => {
    const state = fixture()
    state.setSelection(state.page.value.sections.map(item => item.id)); state.groupWidgets()
    const containerId = state.selectedSection.value
    state.unwrapContainer()
    expect(state.page.value.sections).toHaveLength(2)
    expect(state.page.value.sections.every(item => !item.parentId)).toBe(true)
    state.history.undo()
    expect(state.page.value.sections.some(item => item.id === containerId)).toBe(true)
  })
  it('preserves device-specific height and rotation overrides rather than changing the desktop frame', () => {
    const state = fixture(), entry = state.page.value.sections[0]!
    const original = { ...entry.layout! }
    state.device.value = 'mobile'
    state.commitGeometry(entry.id, { ...original, h: 3 }, undefined, undefined, undefined, true)
    expect(entry.devices?.mobile?.sizing?.height).toBe(96)
    expect(entry.layout).toEqual(original)
    state.commitGeometry(entry.id, original, undefined, undefined, 35)
    expect(entry.devices?.mobile?.appearance?.rotation).toBe(35)
    expect(entry.appearance?.rotation).toBeUndefined()
  })
  it('blocks mutations while the editor is locked', () => {
    const state = fixture(), before = JSON.stringify(state.page.value)
    state.setSelection(state.page.value.sections.map(item => item.id))
    state.locked.value = true
    state.groupWidgets()
    state.commitGeometry(state.selectedSection.value, { x: 0, y: 0, w: 5, h: 5, z: 0 })
    expect(JSON.stringify(state.page.value)).toBe(before)
    expect(state.cancelDrag).not.toHaveBeenCalled()
  })

  it('commits precise keyboard resize and following rows as one reversible history change', () => {
    const state = fixture(), [first, second] = state.page.value.sections
    first!.layout = { x: 2.12749, y: 3.23453, w: 8.31217, h: 6.18741, z: 1 }
    second!.layout = { x: 0, y: 12.12347, w: 12, h: 3, z: 2 }
    state.history.reset(state.site.value)
    const before = structuredClone(state.page.value.sections.map(entry => ({ ...entry.layout! })))
    const next = keyboardGeometry({ [first!.id]: first!.layout }, {
      key: 'ArrowDown', precise: true, action: 'bottom', scale: 2, settings: defaultGrid(),
    })[first!.id]!
    state.commitGeometry(first!.id, next, undefined, undefined, undefined, false, KEYBOARD_GEOMETRY_PRECISION)
    expect(state.page.value.sections[0]!.layout!.h).toBeCloseTo(before[0]!.h + 1 / 64, 10)
    expect(state.page.value.sections[1]!.layout!.y).toBeCloseTo(before[1]!.y + 1 / 64, 10)
    state.history.undo()
    expect(state.page.value.sections.map(entry => entry.layout)).toEqual(before)
    expect(state.history.canUndo.value).toBe(false)
    state.history.redo()
    expect(state.page.value.sections[0]!.layout!.h).toBeCloseTo(next.h, 10)
    expect(state.page.value.sections[1]!.layout!.y).toBeCloseTo(before[1]!.y + 1 / 64, 10)
  })

  it('does not add history for a keyboard height change blocked by the last row', () => {
    const state = fixture(), [first, second] = state.page.value.sections
    first!.layout = { x: 0, y: 0, w: 8, h: 4.123456789123, z: 1 }
    second!.layout = { x: 0, y: 9999, w: 8, h: 1, z: 2 }
    state.history.reset(state.site.value)
    state.commitGeometry(first!.id, { ...first!.layout, h: first!.layout.h + 1 / 64 }, undefined, undefined, undefined, false, KEYBOARD_GEOMETRY_PRECISION)
    expect(state.history.canUndo.value).toBe(false)
    expect(state.page.value.sections[0]!.layout!.h).toBe(4.123456789123)
  })
})
