import { defineComponent, reactive } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAnnouncementDelivery } from '@/composables/useAnnouncementDelivery'
const command = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<unknown>>())
vi.mock('@/services/sharedDashboards', () => ({ sharedDashboardCommand: command }))
const item = { id: 'one', title: 'Update', body: 'Message', audience: 'everyone', publishedAt: 1 }
function setup() {
  const context = reactive({ enabled: true, identity: 'user-a', jobId: '' })
  let delivery!: ReturnType<typeof useAnnouncementDelivery>
  const wrapper = mount(
    defineComponent({
      setup() {
        delivery = useAnnouncementDelivery(() => ({ ...context }))
        return () => null
      },
    }),
  )
  return { context, delivery, wrapper }
}
describe('entry announcement delivery', () => {
  beforeEach(() => command.mockReset().mockResolvedValue({ items: [item] }))
  it('coalesces login, does not repeat on an unchanged job, and repeats on a later job visit', async () => {
    const { context, delivery, wrapper } = setup()
    await flushPromises()
    expect(command).toHaveBeenLastCalledWith('list-announcements', { scope: 'personal' })
    delivery.dismiss()
    context.jobId = 'job-a'
    await flushPromises()
    expect(command).toHaveBeenLastCalledWith('list-announcements', { scope: 'job', jobId: 'job-a' })
    delivery.dismiss()
    context.jobId = 'job-a'
    await flushPromises()
    expect(command).toHaveBeenCalledTimes(2)
    expect(delivery.items.value).toEqual([])
    context.jobId = ''
    await flushPromises()
    expect(command).toHaveBeenCalledTimes(2)
    context.jobId = 'job-a'
    await flushPromises()
    expect(command).toHaveBeenCalledTimes(3)
    wrapper.unmount()
  })
  it('clears old data immediately and ignores a late response after identity/access changes or disposal', async () => {
    let resolve!: (value: unknown) => void
    command.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      }),
    )
    const { context, delivery, wrapper } = setup()
    context.identity = 'user-b'
    await flushPromises()
    expect(delivery.items.value).toEqual([item])
    resolve({ items: [{ ...item, title: 'Previous user' }] })
    await flushPromises()
    expect(delivery.items.value[0]?.title).toBe('Update')
    context.enabled = false
    await flushPromises()
    expect(delivery.items.value).toEqual([])
    command.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      }),
    )
    context.enabled = true
    await flushPromises()
    wrapper.unmount()
    resolve({ items: [item] })
    await flushPromises()
    expect(delivery.items.value).toEqual([])
  })
  it('allows failure retry and dismissal without writing read receipts', async () => {
    command.mockRejectedValueOnce(Error('Offline'))
    const { delivery, wrapper } = setup()
    await flushPromises()
    expect(delivery.error.value).toContain('Offline')
    await delivery.retry()
    expect(delivery.items.value).toEqual([item])
    delivery.dismiss()
    expect(delivery.items.value).toEqual([])
    expect(command.mock.calls.every(([action]) => action === 'list-announcements')).toBe(true)
    wrapper.unmount()
  })
})
