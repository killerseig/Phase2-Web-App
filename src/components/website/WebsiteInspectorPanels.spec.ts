import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import SiteInspector from './WebsiteSiteInspector.vue'
import CollectionInspector from './WebsiteCollectionInspector.vue'
import { newItem, withWebsiteDefaults } from '@/features/website/types'
import { defaultTheme } from '../../../functions/src/websiteTheme'

describe('Website inspector presentation boundaries', () => {
  it('emits site changes and theme commands without mutating the authoring draft', async () => {
    const site = withWebsiteDefaults({ name: 'Original', accent: '#174878', pages: [] })
    const wrapper = shallowMount(SiteInspector, { props: { site, designMode: true, codeMode: false, hideFooter: true } })
    await wrapper.get('input[maxlength="100"]').setValue('Edited name')
    expect(site.name).toBe('Original')
    expect(wrapper.emitted('update')).toEqual([[{ name: 'Edited name' }]])
    const preset = { theme: defaultTheme, accent: '#123456' }
    wrapper.getComponent({ name: 'WebsiteThemeFields' }).vm.$emit('apply', preset)
    wrapper.getComponent({ name: 'WebsiteThemeFields' }).vm.$emit('update', undefined)
    expect(wrapper.emitted('applyTheme')).toEqual([[preset]])
    expect(wrapper.emitted('theme')).toEqual([[undefined]])
    expect(wrapper.getComponent({ name: 'WebsiteBrandingFields' }).props('hideFooter')).toBe(true)
    wrapper.unmount()
  })
  it('keeps code editing and uploading events separate from theme/history commands', () => {
    const site = withWebsiteDefaults({ name: 'Original', accent: '#174878', pages: [] })
    const wrapper = shallowMount(SiteInspector, { props: { site, designMode: false, codeMode: true, hideFooter: false } })
    expect(wrapper.findComponent({ name: 'WebsiteThemeFields' }).exists()).toBe(false)
    wrapper.getComponent({ name: 'WebsitePageCode' }).vm.$emit('css', '.test {}')
    wrapper.getComponent({ name: 'WebsitePageCode' }).vm.$emit('js', undefined)
    wrapper.getComponent({ name: 'WebsiteBrandingFields' }).vm.$emit('uploading', true)
    expect(wrapper.emitted('update')).toEqual([[{ css: '.test {}' }], [{ js: undefined }]])
    expect(wrapper.emitted('uploading')).toEqual([[true]])
    expect(site.css).not.toBe('.test {}')
    wrapper.unmount()
  })
  it('emits collection edits and history actions, retaining focus and ordering limits', async () => {
    const items = [newItem(), newItem()]
    items[0]!.title = 'First'; items[1]!.title = 'Second'
    const wrapper = shallowMount(CollectionInspector, { props: { items, kind: 'cards', designTools: true, focusedId: items[1]!.id } })
    expect(wrapper.get('h3').text()).toBe('Cards')
    expect(wrapper.findAll('.item-editor')[0]!.isVisible()).toBe(false)
    expect(wrapper.findAll('details')[1]!.attributes('open')).toBe('')
    expect(wrapper.get('[aria-label="Move item 1 up"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[aria-label="Move item 2 down"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[aria-label="Move item 2 up"]').trigger('click')
    await wrapper.findAll('.item-actions')[1]!.findAll('button')[2]!.trigger('click')
    wrapper.findAllComponents({ name: 'WebsiteItemFields' })[1]!.vm.$emit('update', { ...items[1], title: 'Updated' })
    expect(wrapper.emitted('move')).toEqual([[{ index: 1, direction: -1 }]])
    expect(wrapper.emitted('remove')).toEqual([[1]])
    expect(wrapper.emitted('update')![0]![0]).toMatchObject({ index: 1, value: { title: 'Updated' } })
    expect(items[1]!.title).toBe('Second')
    await wrapper.setProps({ items: Array.from({ length: 12 }, () => newItem()) })
    expect(wrapper.findAll('button').find(button => button.text() === '+ Add item')!.attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
