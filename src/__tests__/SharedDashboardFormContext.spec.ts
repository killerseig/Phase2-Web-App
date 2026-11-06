import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SharedDashboardForm from '@/components/dashboard/SharedDashboardForm.vue'
const api = vi.hoisted(() =>
  vi.fn<(name: string, data: Record<string, unknown>) => Promise<unknown>>(),
)
vi.mock('@/services/forms', () => ({
  formApi: api,
  isFormServerEnabled: () => true,
  isFormEmulatorEnabled: () => false,
  uploadFormPhoto: vi.fn<() => Promise<void>>(),
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    currentUser: { uid: 'tester' },
    rawRole: 'foreman',
    hasWorkspaceAccess: true,
  }),
}))
afterEach(() => {
  api.mockReset()
  localStorage.clear()
})
const definition = {
  title: 'Independent form',
  description: '',
  recipients: [],
  fields: [{ id: 'note', kind: 'text', label: 'Notes', required: false, options: [] }],
}
describe('explicit dashboard inline form context', () => {
  it.each(['personal', 'role', 'job'] as const)(
    'isolates %s form from workflow selection query',
    async (scope) => {
      const template = { id: 'independent', definition, latestVersion: 1 }
      api.mockImplementation(async (name, data) => {
        if (name === 'formTemplates')
          return data.action === 'respondent' ? template : { templates: [template] }
        if (data.action === 'list') return { records: [] }
        if (data.action === 'create')
          return {
            id: 'record',
            ownerUid: 'tester',
            jobId: data.dashboardJobId || undefined,
            templateId: 'independent',
            templateVersion: 1,
            revision: 1,
            status: 'draft',
            definition: { ...definition, version: 1 },
            answers: {},
            updatedAt: 1,
          }
        throw new Error('Unexpected operation')
      })
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [
          {
            path: '/',
            component: SharedDashboardForm,
            props: {
              scope,
              canRespond: true,
              jobId: scope === 'job' ? 'explicit-job' : undefined,
              widget: {
                id: 'inline',
                type: 'form',
                title: '',
                text: '',
                span: 12,
                form: { templateId: 'independent', version: 1, presentation: 'inline' },
              },
            },
          },
        ],
      })
      await router.push('/?dashboardJob=workflow-selection')
      await router.isReady()
      const wrapper = mount(RouterView, {
        global: {
          plugins: [router],
          stubs: { BuilderConfirmDialog: true, FormRecipientVerification: true },
        },
      })
      await flushPromises()
      const expectedJob = scope === 'job' ? 'explicit-job' : undefined
      const list = api.mock.calls.find(
        ([name, data]) => name === 'formWorkspace' && data.action === 'list',
      )
      expect(list?.[1].dashboardJobId).toBe(expectedJob)
      await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Start draft')!
        .trigger('click')
      await flushPromises()
      const create = api.mock.calls.find(([, data]) => data.action === 'create')
      expect(create?.[1].dashboardJobId).toBe(expectedJob)
      expect(create?.[1].templateId).toBe('independent')
      wrapper.unmount()
    },
  )
})
