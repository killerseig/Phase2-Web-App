import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import MyTimecardView from './MyTimecardView.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
const state = vi.hoisted(() => ({
  auth: null as unknown as {
    currentUser: { uid: string } | null
    rawRole: string
    hasWorkspaceAccess: boolean
  },
  jobs: null as unknown as {
    activeJobs: Array<{ id: string; code: string; name: string }>
    subscribeVisibleJobs: () => void
  },
  request: vi.fn(),
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => state.auth }))
vi.mock('@/stores/jobs', () => ({ useJobsStore: () => state.jobs }))
vi.mock('@/services/personalTimecard', () => ({ personalTimecardRequest: state.request }))
vi.mock('vue-router', () => ({ onBeforeRouteLeave: vi.fn() }))
const saved = () => ({
  state: 'ready',
  employeeName: 'Synthetic Employee',
  version: '1:0',
  readOnly: false,
  card: {
    notes: '',
    lines: Array.from({ length: 13 }, () => ({
      jobNumber: '',
      subsectionArea: '',
      account: '',
      hours: Array(7).fill(0),
    })),
  },
})
const mountView = () =>
  mount(MyTimecardView, { global: { stubs: { AppShell: { template: '<div><slot/></div>' } } } })
async function open(wrapper: ReturnType<typeof mountView>) {
  await wrapper.get('select').setValue('job-a')
  await wrapper.get('button').trigger('click')
  await flushPromises()
}
async function edit(wrapper: ReturnType<typeof mountView>) {
  await wrapper.get('input[aria-label="Line 1 job number"]').setValue('100')
  await wrapper.get('input[aria-label="Line 1 account"]').setValue('PAINT')
  await wrapper.get('input[aria-label="Line 1 MON hours"]').setValue('4')
}
beforeEach(() => {
  state.auth = reactive({
    currentUser: { uid: 'me' },
    rawRole: 'project-manager',
    hasWorkspaceAccess: true,
  })
  state.jobs = reactive({
    activeJobs: [
      { id: 'job-a', code: '100', name: 'First job' },
      { id: 'job-b', code: '200', name: 'Second job' },
    ],
    subscribeVisibleJobs: vi.fn(),
  })
  state.request.mockReset()
  state.request.mockResolvedValue(saved())
})
describe('My Timecard local user flow', () => {
  it('opens only a selected job and saves a personal draft through the scoped action', async () => {
    const w = mountView()
    expect(w.get('button').attributes('disabled')).toBeDefined()
    await open(w)
    await edit(w)
    state.request.mockResolvedValue({
      ...saved(),
      version: '2:0',
      card: {
        ...saved().card,
        lines: saved().card.lines.map((line, i) =>
          i === 0
            ? { ...line, jobNumber: '100', account: 'PAINT', hours: [0, 4, 0, 0, 0, 0, 0] }
            : line,
        ),
      },
    })
    await w.findAll('button').at(-1)!.trigger('click')
    await flushPromises()
    expect(state.request).toHaveBeenLastCalledWith(
      expect.objectContaining({ personalAction: 'save', jobId: 'job-a', expectedVersion: '1:0' }),
    )
    expect(w.text()).toContain('draft was saved')
    expect(w.findAll('button').at(-1)!.attributes('disabled')).toBeDefined()
    w.unmount()
  })
  it('retains edits and reuses a request id after a failed response', async () => {
    const w = mountView()
    await open(w)
    await edit(w)
    state.request.mockRejectedValue(new Error('Connection lost'))
    await w.findAll('button').at(-1)!.trigger('click')
    await flushPromises()
    const first = state.request.mock.calls.at(-1)![0]
    expect((w.get('input[aria-label="Line 1 MON hours"]').element as HTMLInputElement).value).toBe(
      '4',
    )
    expect(w.text()).toContain('Unsaved changes')
    await w.findAll('button').at(-1)!.trigger('click')
    await flushPromises()
    expect(state.request.mock.calls.at(-1)![0].requestId).toBe(first.requestId)
    w.unmount()
  })
  it('prompts only for meaningful edits and retains them on cancel', async () => {
    const w = mountView()
    await open(w)
    await edit(w)
    await w.get('select').setValue('job-b')
    await flushPromises()
    expect(w.findComponent(ConfirmDialog).props('open')).toBe(true)
    w.findComponent(ConfirmDialog).vm.$emit('cancel')
    await flushPromises()
    expect((w.get('select').element as HTMLSelectElement).value).toBe('job-a')
    expect((w.get('input[aria-label="Line 1 MON hours"]').element as HTMLInputElement).value).toBe(
      '4',
    )
    w.unmount()
  })
  it('clears private values on logout and ignores a stale response', async () => {
    let resolve!: (result: ReturnType<typeof saved>) => void
    state.request.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const w = mountView()
    await w.get('select').setValue('job-a')
    await w.get('button').trigger('click')
    state.auth.currentUser = null
    state.auth.hasWorkspaceAccess = false
    await flushPromises()
    resolve(saved())
    await flushPromises()
    expect(w.text()).not.toContain('Synthetic Employee')
    w.unmount()
  })
  it('keeps submitted weeks read-only', async () => {
    state.request.mockResolvedValue({ ...saved(), readOnly: true })
    const w = mountView()
    await open(w)
    expect(w.get('fieldset').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('locked')
    w.unmount()
  })
})
