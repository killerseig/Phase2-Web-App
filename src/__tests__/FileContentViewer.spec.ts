import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import FileContentViewer from '@/components/dashboard/FileContentViewer.vue'

afterEach(() => vi.unstubAllGlobals())
it('rejects an app-shell HTML response instead of interpreting it as document contents', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Employee app shell</html>', { headers: { 'Content-Type': 'text/html' } })))
  const worker = vi.fn()
  vi.stubGlobal('Worker', worker)
  const wrapper = mount(FileContentViewer, { props: { url: 'https://example.invalid/file?ticket=test', extension: 'txt', name: 'Synthetic notes' } })
  await flushPromises()
  expect(wrapper.get('[role=alert]').text()).toContain('could not be loaded')
  expect(wrapper.find('pre').exists()).toBe(false)
  expect(worker).not.toHaveBeenCalled()
  wrapper.unmount()
})


it('waits for the image element to load and releases errors instead of claiming byte arrival is readiness', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2]), { headers: { 'Content-Type': 'image/png' } })))
  const wrapper = mount(FileContentViewer, { props: { url: 'https://example.invalid/image', extension: 'png', name: 'Synthetic photo' } })
  await flushPromises()
  expect(wrapper.find('img').exists()).toBe(true)
  expect(wrapper.emitted('settled')).toBeUndefined()
  await wrapper.get('img').trigger('load'); await flushPromises()
  expect(wrapper.emitted('settled')).toEqual([['https://example.invalid/image']])
  wrapper.unmount()
})
