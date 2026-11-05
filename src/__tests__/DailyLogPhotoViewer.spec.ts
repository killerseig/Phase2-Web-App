import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import DailyLogPhotoViewer from '@/components/dailyLogs/DailyLogPhotoViewer.vue'
import DocumentZoomControls from '@/components/dashboard/DocumentZoomControls.vue'
const photo = { name: 'synthetic-original.jpg', url: 'https://example.invalid/original.jpg', description: 'Synthetic QC detail' }
const create = () => mount(DailyLogPhotoViewer, { props: { photo, sectionTitle: 'QC Photos', position: 1, total: 2 } })
describe('daily-log original photo viewing', () => {
  it('uses the stored original and shared zoom controls rather than a thumbnail', async () => {
    const wrapper = create()
    expect(wrapper.get('img').attributes('src')).toBe(photo.url)
    expect(wrapper.get('a').attributes()).toMatchObject({ href: photo.url, target: '_blank', rel: 'noopener noreferrer' })
    expect(wrapper.findComponent(DocumentZoomControls).props('minZoom')).toBe(1)
    wrapper.findComponent(DocumentZoomControls).vm.$emit('change', 2)
    await flushPromises()
    expect(wrapper.get('.daily-log-gallery__image-canvas').attributes('style')).toContain('width: 200%')
    await wrapper.get('[aria-label="Fit photo"]').trigger('click'); await flushPromises()
    expect(wrapper.get('.daily-log-gallery__image-canvas').attributes('style')).toContain('width: 100%')
    wrapper.unmount()
  })
  it('reports limited source resolution and resets dimensions/zoom when switching photos', async () => {
    const wrapper = create(), image = wrapper.get('img')
    Object.defineProperties(image.element, { naturalWidth: { value: 240 }, naturalHeight: { value: 320 } })
    await image.trigger('load')
    expect(wrapper.text()).toContain('zoom cannot restore missing resolution')
    wrapper.findComponent(DocumentZoomControls).vm.$emit('change', 3); await flushPromises()
    await wrapper.setProps({ photo: { ...photo, url: 'https://example.invalid/other.jpg' } }); await flushPromises()
    expect(wrapper.text()).not.toContain('missing resolution')
    expect(wrapper.findComponent(DocumentZoomControls).props('zoom')).toBe(1)
    wrapper.unmount()
  })
  it('supports keyboard zoom, fit, navigation and close', async () => {
    const wrapper = create()
    await wrapper.trigger('keydown', { key: '+' }); await flushPromises()
    expect(wrapper.findComponent(DocumentZoomControls).props('zoom')).toBe(1.25)
    await wrapper.get('.daily-log-gallery__image-scroll').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('next')).toBeUndefined()
    await wrapper.trigger('keydown', { key: '0' }); await flushPromises()
    expect(wrapper.findComponent(DocumentZoomControls).props('zoom')).toBe(1)
    await wrapper.trigger('keydown', { key: 'ArrowRight' }); expect(wrapper.emitted('next')).toHaveLength(1)
    await wrapper.trigger('keydown', { key: 'Escape' }); expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })
  it('keeps an honest original-file fallback if an image fails', async () => {
    const wrapper = create()
    await wrapper.get('img').trigger('error')
    expect(wrapper.get('[role="alert"]').text()).toContain('could not be displayed')
    expect(wrapper.get('a').attributes('href')).toBe(photo.url)
    wrapper.unmount()
  })
})
describe('shared document zoom default compatibility', () => {
  it('retains existing document minimum and maximum with an opt-in photo minimum', async () => {
    const wrapper = mount(DocumentZoomControls, { props: { zoom: 1 } })
    await wrapper.get('[aria-label="Zoom out"]').trigger('click')
    expect(wrapper.emitted('change')?.[0]).toEqual([.75])
    await wrapper.setProps({ minZoom: 1 })
    expect(wrapper.get('[aria-label="Zoom out"]').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ zoom: 3 })
    expect(wrapper.get('[aria-label="Zoom in"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
