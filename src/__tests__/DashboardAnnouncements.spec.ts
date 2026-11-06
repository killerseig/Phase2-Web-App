import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardAnnouncements from '@/components/dashboard/DashboardAnnouncements.vue'
import { useAuthStore } from '@/stores/auth'
const fake = vi.hoisted(() => ({ command: vi.fn(), auth: {currentUser:{uid:'viewer'}, rawRole:'foreman', hasWorkspaceAccess:true, assignedJobIds: [] as string[]} }))
vi.mock('@/services/sharedDashboards', () => ({sharedDashboardCommand: fake.command}))
vi.mock('@/stores/auth', async () => { const {reactive} = await import('vue'); const auth = reactive(fake.auth); return {useAuthStore: () => auth} })
const auth = useAuthStore() as unknown as typeof fake.auth
const item = {id:'update',title:'For this viewer',body:'<img src=x> literal text',audience:'everyone',publishedAt:1}
describe('authorized announcement feed lifecycle', () => {
  beforeEach(() => { fake.command.mockReset(); auth.hasWorkspaceAccess = true; auth.currentUser.uid = 'viewer'; auth.assignedJobIds = [] })
  it('retries a local failure and renders announcement text literally', async () => {
    fake.command.mockRejectedValueOnce(Error('Temporary failure')).mockResolvedValue({items:[item],limit:50})
    const wrapper = mount(DashboardAnnouncements,{props:{scope:'personal',layoutEditing:false}})
    await flushPromises()
    expect(wrapper.find('[role=alert]').text()).toContain('Temporary failure')
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('<img src=x> literal text')
    expect(wrapper.find('img').exists()).toBe(false)
    wrapper.unmount()
  })
  it('ignores late results from the previous dashboard context', async () => {
    let resolve!: (value: unknown) => void
    fake.command.mockReturnValueOnce(new Promise(done => {resolve = done})).mockResolvedValue({items:[item],limit:50})
    const wrapper = mount(DashboardAnnouncements,{props:{scope:'personal',layoutEditing:false}})
    await wrapper.setProps({scope:'job',jobId:'job-a'})
    await flushPromises()
    resolve({items:[{...item,title:'Previous context'}],limit:50})
    await flushPromises()
    expect(wrapper.text()).toContain('For this viewer')
    expect(wrapper.text()).not.toContain('Previous context')
    expect(fake.command).toHaveBeenLastCalledWith('list-announcements',{scope:'job',jobId:'job-a'})
    wrapper.unmount()
  })
  it('clears cached messages when workspace access is revoked', async () => {
    fake.command.mockResolvedValue({items:[item],limit:50})
    const wrapper = mount(DashboardAnnouncements,{props:{scope:'personal',layoutEditing:false}})
    await flushPromises()
    expect(wrapper.text()).toContain('For this viewer')
    auth.hasWorkspaceAccess = false
    await nextTick()
    expect(wrapper.text()).not.toContain('For this viewer')
    expect(wrapper.text()).toContain('You do not have access')
    wrapper.unmount()
  })
})
