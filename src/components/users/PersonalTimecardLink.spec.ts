import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PersonalTimecardLink from './PersonalTimecardLink.vue'
const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('@/services/personalTimecard', () => ({ personalTimecardRequest: mocks.request }))
beforeEach(() => { mocks.request.mockReset(); mocks.request.mockResolvedValue({ status: 'matched', employeeName: 'Synthetic Employee', employeeNumber: 'T1' }) })
describe('automatic payroll account association', () => {
  it('shows matching status without an employee selector or mutation on open', async () => {
    const wrapper = mount(PersonalTimecardLink, { props: { uid: 'account', actorUid: 'admin' } })
    await flushPromises()
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.find('button').exists()).toBe(false)
    expect(mocks.request).toHaveBeenCalledExactlyOnceWith({ personalAction: 'link-status', accountUid: 'account' })
    expect(wrapper.text()).toContain('applied automatically when the account is saved')
    wrapper.unmount()
  })
  it('waits for account autosave before refreshing matching status', async () => {
    const wrapper = mount(PersonalTimecardLink, { props: { uid: 'account', actorUid: 'admin', disabled: true } })
    expect(mocks.request).not.toHaveBeenCalled()
    await wrapper.setProps({ disabled: false }); await flushPromises()
    expect(mocks.request).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
  it('reports ambiguity without exposing a selector or claiming successful linking', async () => {
    mocks.request.mockResolvedValue({ status: 'ambiguous' })
    const wrapper = mount(PersonalTimecardLink, { props: { uid: 'account', actorUid: 'admin' } })
    await flushPromises()
    expect(wrapper.text()).toContain('ambiguous')
    expect(wrapper.text()).not.toContain('Linked to')
    expect(wrapper.find('select').exists()).toBe(false)
    wrapper.unmount()
  })
})
