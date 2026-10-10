import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import ReportsView from './ReportsView.vue'
const api = vi.hoisted(() => vi.fn())
vi.mock('@/services/forms', () => ({ formApi: api }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ rawRole: 'payroll', hasWorkspaceAccess: true, currentUser: { uid: 'payroll-user' } }) }))
const definition = { title: 'Committee', access: { respondents: 'signed-in', identity: 'identified', respondentUserIds: [], respondentRoles: ['foreman'], entryUserIds: [], entryRoles: [] } }
function render() { return mount(ReportsView, { global: { stubs: { AppShell: { template: '<div><slot /></div>' }, RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } }) }
beforeEach(() => { api.mockReset() })
describe('Reports permissions and states', () => {
  it('shows only published forms allowed for the existing account', async () => {
    api.mockResolvedValue({ templates: [
      { id: 'restricted', definition, latestVersion: 1 },
      { id: 'public', definition: { ...definition, title: 'General Visit', access: { ...definition.access, respondents: 'public' } }, latestVersion: 1 },
      { id: 'draft', definition, latestVersion: 0 },
      { id: 'archived', definition, latestVersion: 1, archived: true },
    ] })
    const view = render(); await flushPromises()
    expect(view.findAll('a').map(a => a.attributes('href'))).toEqual(['/forms/public'])
    expect(view.text()).not.toContain('Manage forms in Form Builder')
    await view.find('input').setValue('missing')
    expect(view.text()).toContain('No published reports match')
  })
  it('reports service failures instead of presenting false empty success', async () => {
    api.mockImplementation(async () => { throw new Error('Service unavailable') })
    const view = render(); await flushPromises()
    expect(view.find('[role="alert"]').text()).toContain('Service unavailable')
    expect(view.text()).not.toContain('No published reports match')
  })
})
