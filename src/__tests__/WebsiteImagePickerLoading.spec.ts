import { describe, expect, it, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import WebsiteImagePicker from '@/components/website/WebsiteImagePicker.vue'
import AppLoadingRegion from '@/components/common/AppLoadingRegion.vue'
const { command } = vi.hoisted(() => ({ command: vi.fn() }))
vi.mock('@/services/website', () => ({ websiteCommand: command, websiteError: (error: Error) => error.message, uploadWebsiteImage: vi.fn() }))
const originalDialogMethods = ['showModal', 'close'].map(key => [key, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, key)] as const)
afterEach(() => {
  for (const [key, descriptor] of originalDialogMethods) { if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor); else Reflect.deleteProperty(HTMLDialogElement.prototype, key) }
  command.mockReset()
})
describe('image-library loading ownership', () => {
  it('covers the initial results then leaves loaded choices usable during load more and errors', async () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false } })
    let finish!: (value: unknown) => void
    command.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const wrapper = mount(WebsiteImagePicker, { props: { imageId: '', alt: '' }, global: { stubs: { Teleport: true, WebsiteImage: true } } })
    await wrapper.get('.image-actions button').trigger('click'); await flushPromises()
    const results = wrapper.getComponent(AppLoadingRegion)
    expect(results.props('loading')).toBe(true)
    expect(wrapper.get('dialog header button').attributes('disabled')).toBeUndefined()
    finish({ images: [{ id: 'photo-a', name: 'Synthetic image', size: 1000 }], nextCursor: 'more' }); await flushPromises()
    await vi.waitFor(() => expect(wrapper.find('[aria-label="Use Synthetic image"]').exists()).toBe(true))
    wrapper.getComponent({ name: 'AppLoadingOverlay' }).vm.$emit('afterLeave'); await flushPromises()
    let fail!: (reason: Error) => void
    command.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject }))
    await wrapper.findAll('footer button').find(button => button.text() === 'Load more images')!.trigger('click')
    expect(wrapper.getComponent(AppLoadingRegion).props('loading')).toBe(false)
    expect(wrapper.get('.app-loading-region__content').attributes('inert')).toBeUndefined()
    expect(wrapper.get('[role="status"]').text()).toContain('Loading more images')
    expect(wrapper.get('[aria-label="Use Synthetic image"]').attributes('disabled')).toBeUndefined()
    fail(Error('Synthetic image-library failure')); await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Synthetic image-library failure')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Use Synthetic image"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
