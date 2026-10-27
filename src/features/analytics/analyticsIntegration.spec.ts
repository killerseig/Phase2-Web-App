import { reactive, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createUsageAnalytics, type UsageEvent, type UsageAnalytics, type Consent } from './usageAnalytics'
const fake = vi.hoisted(() => ({ auth: { hasWorkspaceAccess: false }, analytics: {} as Record<string, { controller: UsageAnalytics; choice: { value: Consent }; setConsent: (value: Consent) => void }> }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => fake.auth }))
vi.mock('@/composables/useIdleSessionTimeout', () => ({ useIdleSessionTimeout: () => {} }))
vi.mock('./useUsageAnalytics', () => ({ publicUsageKey: Symbol('test-public-usage'), useUsageAnalytics: (scope: string) => fake.analytics[scope] }))
vi.mock('@/components/website/WebsiteCanvas.vue', () => ({ default: { template: '<p>Published page</p>' } }))
vi.mock('@/services/publicWebsite', () => ({ initialPublicSnapshot: () => ({ site: { name: 'Synthetic website', pages: [{ id: 'public-home', slug: 'home', title: 'Home', sections: [] }, { id: 'public-services', slug: 'services', title: 'Services', sections: [] }] }, version: 'public-1' }), loadPublicSnapshot: () => { throw new Error('No live reads in this fixture') } }))
import App from '@/App.vue'
import PublicRoot from '@/PublicRoot.vue'
import PublicWebsiteView from '@/views/PublicWebsiteView.vue'
const disposals: Array<() => void> = []
afterEach(() => disposals.splice(0).forEach(dispose => dispose()))
function setup(scope: 'public' | 'employee') {
  const send = vi.fn<(event: UsageEvent) => void>(), stop = vi.fn<() => void>(), choice = ref<Consent>('unknown')
  const controller = createUsageAnalytics({ scope, enabled: true, approved: true, hosts: ['phase2.example'], origin: 'https://phase2.example', measurementId: scope === 'public' ? 'G-PUBLIC1234' : 'G-INTERNAL12' }, () => ({ send, stop }), value => { choice.value = value })
  fake.analytics[scope] = { controller, choice, setConsent: value => controller.setConsent(value) }
  disposals.push(() => controller.dispose())
  return { controller, send, stop }
}
describe('actual app/public analytics wiring with local mock transport', () => {
  it('observes only coarse authorized employee routes and clears visit consent on logout', async () => {
    fake.auth = reactive({ hasWorkspaceAccess: true })
    const state = setup('employee')
    const router = createRouter({ history: createMemoryHistory(), routes: [
      { path: '/jobs', name: 'jobs', component: { template: '<p>Jobs</p>' } },
      { path: '/jobs/:jobId', name: 'job-dashboard', component: { template: '<p>Job</p>' } },
      { path: '/login', name: 'login', component: { template: '<p>Login</p>' } },
    ] })
    await router.push('/jobs'); await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] } }); disposals.push(() => wrapper.unmount())
    expect(state.send).not.toHaveBeenCalled()
    await wrapper.findAll('button').find(button => button.text() === 'Allow analytics')!.trigger('click')
    await router.push('/jobs/PRIVATE-JOB?email=PRIVATE-EMAIL#PRIVATE-HASH'); await flushPromises()
    await router.push('/jobs/OTHER-JOB?answer=PRIVATE-ANSWER'); await flushPromises()
    expect(state.send.mock.calls.map(([event]) => event)).toEqual([
      { scope: 'employee', name: 'feature_view', feature: 'jobs' }, { scope: 'employee', name: 'feature_view', feature: 'job_dashboard' },
    ])
    expect(JSON.stringify(state.send.mock.calls)).not.toMatch(/PRIVATE|OTHER-JOB/)
    fake.auth.hasWorkspaceAccess = false; await router.push('/login'); await flushPromises()
    expect(fake.analytics.employee!.choice.value).toBe('unknown')
    expect(wrapper.find('[aria-label="Employee analytics choices"]').exists()).toBe(false)
    expect(state.stop).toHaveBeenCalledOnce()
  })
  it('tracks resolved public pages separately and ignores query-only changes, polling and unknown pages', async () => {
    const state = setup('public')
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:slug?', name: 'public-website', component: PublicWebsiteView }] })
    await router.push('/'); await router.isReady()
    const wrapper = mount(PublicRoot, { global: { plugins: [router] } }); disposals.push(() => wrapper.unmount())
    expect(state.send).not.toHaveBeenCalled()
    await wrapper.findAll('button').find(button => button.text() === 'Allow analytics')!.trigger('click')
    await router.push('/?secret=PRIVATE'); await flushPromises()
    await router.push('/services'); await flushPromises()
    await router.push('/services#PRIVATE'); await flushPromises()
    await router.push('/not-a-published-page'); await flushPromises()
    expect(state.send.mock.calls.map(([event]) => event)).toMatchObject([{ name: 'page_view', scope: 'public', page: 'home' }, { name: 'page_view', scope: 'public', page: 'services' }])
    expect(JSON.stringify(state.send.mock.calls)).not.toContain('PRIVATE')
  })
})
