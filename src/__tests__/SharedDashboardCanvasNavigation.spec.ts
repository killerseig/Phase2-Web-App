import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import SharedDashboardCanvas from '@/components/dashboard/SharedDashboardCanvas.vue'
import type { SharedDashboardWidget } from '@/features/dashboard/sharedDashboards'

const checks = vi.hoisted(() => ({ documents: vi.fn<() => boolean>(), resources: vi.fn<() => boolean>() }))
vi.mock('@/components/dashboard/CompanyLibraryWidget.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/components/dashboard/RoleResourcesModule.vue', () => ({ default: { template: '<div />' } }))
const participant = (prepareNavigation: () => boolean) => defineComponent({
  props: ['fixedRole'],
  setup(_, { expose }) { expose({ prepareNavigation }) },
  template: '<div />',
})
const widget = (type: SharedDashboardWidget['type']): SharedDashboardWidget => ({ id: type, type, title: '', text: '', span: 12 })
const library = participant(checks.documents)
const resource = participant(checks.resources)
const mountCanvas = () => mount(SharedDashboardCanvas, {
  props: {
    scope: 'role', widgets: [widget('documents'), widget('resources'), widget('jobs')],
    job: null, jobs: [], notes: {}, events: [], role: 'admin', resourceRole: 'foreman',
    textContext: { user: { name: 'Admin', role: 'Admin' } }, editing: false, selected: '', canEditNotes: true, busy: false,
  },
  global: { stubs: {
    CompanyLibraryWidget: library,
    RoleResourcesModule: resource,
  } },
})
describe('dashboard nested navigation preparation', () => {
  it('consults document and resource drafts and uses the selected resource role', async () => {
    checks.documents.mockReturnValue(false)
    checks.resources.mockReturnValue(true)
    const wrapper = mountCanvas()
    expect(await wrapper.vm.prepareForms()).toBe(false)
    expect(checks.resources).not.toHaveBeenCalled()
    checks.documents.mockReturnValue(true)
    checks.resources.mockReturnValue(false)
    expect(await wrapper.vm.prepareForms()).toBe(false)
    checks.resources.mockReturnValue(true)
    expect(await wrapper.vm.prepareForms()).toBe(true)
    expect(wrapper.findComponent(resource).props('fixedRole')).toBe('foreman')
    expect(wrapper.text().match(/No jobs are available for your account\./g)).toHaveLength(1)
    wrapper.unmount()
  })
})

