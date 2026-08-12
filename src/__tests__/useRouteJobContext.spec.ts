import { defineComponent, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useRouteJobContext } from '@/composables/useRouteJobContext'
import { useJobsStore } from '@/stores/jobs'
import type { JobRecord } from '@/types/domain'

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    active: true,
    assignedForemanIds: [],
    code: '5229',
    finishDate: null,
    foreman: null,
    gc: null,
    id: 'job-1',
    jobAddress: null,
    name: 'Lucky 3 Ranch',
    notificationRecipients: {
      dailyLogs: [],
      shopOrders: [],
      timecards: [],
    },
    productionBurden: null,
    projectManager: null,
    startDate: null,
    type: 'General',
    ...overrides,
  }
}

async function mountRouteContext(routePath = '/jobs/job-1/timecards') {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/jobs/:jobId/:module?',
        component: {
          template: '<div />',
        },
      },
      {
        path: '/',
        component: {
          template: '<div />',
        },
      },
    ],
  })
  await router.push(routePath)
  await router.isReady()

  const jobsStore = useJobsStore()
  let context!: ReturnType<typeof useRouteJobContext>
  const Harness = defineComponent({
    name: 'RouteJobContextHarness',
    setup() {
      context = useRouteJobContext()
      return () => null
    },
  })

  const wrapper = mount(Harness, {
    global: {
      plugins: [pinia, router],
    },
  })

  return {
    context,
    jobsStore,
    router,
    wrapper,
  }
}

let activeWrapper: VueWrapper | null = null

describe('useRouteJobContext', () => {
  afterEach(() => {
    activeWrapper?.unmount()
    activeWrapper = null
    vi.restoreAllMocks()
  })

  it('resolves the route job id and selected current job from the jobs store', async () => {
    const currentJob = makeJob({
      id: 'job-current',
      name: 'Current Route Job',
    })
    const listJob = makeJob({
      id: 'job-current',
      name: 'Older List Copy',
    })
    const mounted = await mountRouteContext('/jobs/job-current/timecards')
    activeWrapper = mounted.wrapper

    mounted.jobsStore.jobs = [listJob]
    mounted.jobsStore.currentJob = currentJob

    expect(mounted.context.jobId.value).toBe('job-current')
    expect(mounted.context.job.value).toStrictEqual(currentJob)
  })

  it('falls back to the visible jobs list when the current job does not match the route', async () => {
    const routeJob = makeJob({
      id: 'job-list',
      name: 'List Route Job',
    })
    const otherCurrentJob = makeJob({
      id: 'job-other',
      name: 'Other Current Job',
    })
    const mounted = await mountRouteContext('/jobs/job-list/shop-orders')
    activeWrapper = mounted.wrapper

    mounted.jobsStore.jobs = [routeJob]
    mounted.jobsStore.currentJob = otherCurrentJob

    expect(mounted.context.jobId.value).toBe('job-list')
    expect(mounted.context.job.value).toStrictEqual(routeJob)
  })

  it('reacts when route params or jobs store records change', async () => {
    const firstJob = makeJob({
      id: 'job-first',
      name: 'First Job',
    })
    const secondJob = makeJob({
      id: 'job-second',
      name: 'Second Job',
    })
    const mounted = await mountRouteContext('/jobs/job-first/daily-logs')
    activeWrapper = mounted.wrapper

    mounted.jobsStore.jobs = [firstJob]
    expect(mounted.context.jobId.value).toBe('job-first')
    expect(mounted.context.job.value).toStrictEqual(firstJob)

    mounted.jobsStore.jobs = [firstJob, secondJob]
    await mounted.router.push('/jobs/job-second/timecards')
    await nextTick()

    expect(mounted.context.jobId.value).toBe('job-second')
    expect(mounted.context.job.value).toStrictEqual(secondJob)
  })

  it('subscribes to the current route job when a route job id exists', async () => {
    const mounted = await mountRouteContext('/jobs/job-subscribe/timecards')
    activeWrapper = mounted.wrapper
    const subscribeJob = vi.spyOn(mounted.jobsStore, 'subscribeJob').mockImplementation(() => {})

    mounted.context.subscribeRouteJob()

    expect(subscribeJob).toHaveBeenCalledWith('job-subscribe')
  })

  it('does not subscribe when the route has no job id', async () => {
    const mounted = await mountRouteContext('/')
    activeWrapper = mounted.wrapper
    const subscribeJob = vi.spyOn(mounted.jobsStore, 'subscribeJob').mockImplementation(() => {})

    mounted.context.subscribeRouteJob()

    expect(mounted.context.jobId.value).toBe('')
    expect(mounted.context.job.value).toBeNull()
    expect(subscribeJob).not.toHaveBeenCalled()
  })

  it('delegates route job cleanup to the jobs store', async () => {
    const mounted = await mountRouteContext('/jobs/job-cleanup/timecards')
    activeWrapper = mounted.wrapper
    const stopCurrentJobSubscription = vi
      .spyOn(mounted.jobsStore, 'stopCurrentJobSubscription')
      .mockImplementation(() => {})

    mounted.context.stopRouteJobSubscription()

    expect(stopCurrentJobSubscription).toHaveBeenCalledTimes(1)
  })
})
