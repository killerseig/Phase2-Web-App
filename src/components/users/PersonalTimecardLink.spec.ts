import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PersonalTimecardLink from './PersonalTimecardLink.vue'
const mocks = vi.hoisted(() => ({ confirm: vi.fn() }))
vi.mock('@/services/employees', () => ({
  subscribeEmployees: (next: (rows: unknown[]) => void) => {
    next([
      {
        id: 'employee',
        firstName: 'Synthetic',
        lastName: 'Employee',
        employeeNumber: 'T1',
        active: true,
      },
    ])
    return () => {}
  },
}))
vi.mock('@/services/personalTimecard', () => ({
  subscribePersonalTimecardLink: (_uid: string, next: (id: string) => void) => {
    next('')
    return () => {}
  },
  confirmPersonalTimecardLink: mocks.confirm,
}))
beforeEach(() => {
  mocks.confirm.mockReset()
  mocks.confirm.mockResolvedValue(undefined)
})
describe('explicit payroll employee confirmation', () => {
  it('does not infer a match or save before an explicit choice', async () => {
    const w = mount(PersonalTimecardLink, { props: { uid: 'chosen-user', actorUid: 'admin' } })
    expect((w.get('select').element as HTMLSelectElement).value).toBe('')
    expect(w.get('button').attributes('disabled')).toBeDefined()
    expect(mocks.confirm).not.toHaveBeenCalled()
    w.unmount()
  })
  it('waits for normal account autosaves before linking', async () => {
    const w = mount(PersonalTimecardLink, {
      props: { uid: 'chosen-user', actorUid: 'admin', disabled: true },
    })
    expect(w.get('select').attributes('disabled')).toBeDefined()
    await w.get('button').trigger('click')
    expect(mocks.confirm).not.toHaveBeenCalled()
    w.unmount()
  })
  it('confirms only the selected account and employee', async () => {
    const w = mount(PersonalTimecardLink, { props: { uid: 'chosen-user', actorUid: 'admin' } })
    await w.get('select').setValue('employee')
    await w.get('button').trigger('click')
    await flushPromises()
    expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith('admin', 'chosen-user', 'employee')
    expect(w.text()).toContain('Role activation is separate')
    w.unmount()
  })
})
