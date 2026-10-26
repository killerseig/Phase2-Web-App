import { computed, effectScope, nextTick, ref, type EffectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWebsiteWidgetEditing } from './useWebsiteWidgetEditing'
import { useWebsiteHistory } from './useWebsiteHistory'
import { newSection, withWebsiteDefaults, type WebsiteSite, type WebsiteDevice } from './types'
import type { ElementTarget } from './textBox'

const scopes: EffectScope[] = []
function fixture() {
  const scope = effectScope(); scopes.push(scope)
  return scope.run(() => {
    const site = ref<WebsiteSite>(withWebsiteDefaults({ name: 'Synthetic', accent: '#174878', pages: [{ id: 'home', chrome: 'widgets', title: 'Home', slug: 'home', description: '', inNavigation: true, sections: [newSection('text'), newSection('text')] }] }))
    const history = useWebsiteHistory(site); history.reset(site.value)
    const page = computed(() => site.value.pages[0]!)
    const selectedSection = ref(''), selectedIds = ref<string[]>([]), selectedText = ref<ElementTarget>()
    const section = computed(() => page.value.sections.find(item => item.id === selectedSection.value))
    const locked = ref(false), device = ref<WebsiteDevice>('desktop'), cancelDrag = vi.fn(), focusArrangement = vi.fn()
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
})
