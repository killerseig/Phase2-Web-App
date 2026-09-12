import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import RoleDashboardModuleGrid from '@/components/dashboard/RoleDashboardModuleGrid.vue'
import RoleDashboardView from '@/views/RoleDashboardView.vue'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'

const routerLinkStub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>',
}

const appShellStub = {
  name: 'AppShell',
  template: '<main data-testid="app-shell"><slot /></main>',
}

describe('RoleDashboardModuleGrid', () => {
  it('renders target dashboard modules as absolute route cards', () => {
    const wrapper = mount(RoleDashboardModuleGrid, {
      global: {
        stubs: {
          RouterLink: routerLinkStub,
        },
      },
      props: {
        modules: [
          {
            detail: 'Maintain employee information.',
            key: 'employees',
            label: 'Employees',
            targetRoute: '/employees',
          },
          {
            detail: 'Review submitted timecards.',
            key: 'timecard-export',
            label: 'Timecard Export',
            targetRoute: '/exports/timecards',
          },
        ],
      },
    })

    expect(wrapper.get('[data-testid="role-dashboard-module-employees"]').attributes('href')).toBe(
      '/employees',
    )
    expect(wrapper.get('[data-testid="role-dashboard-module-timecard-export"]').attributes('href')).toBe(
      '/exports/timecards',
    )
    expect(wrapper.text()).toContain('Maintain employee information.')
    expect(wrapper.text()).toContain('Review submitted timecards.')
  })

  it('renders a safe empty state when no modules are available', () => {
    const wrapper = mount(RoleDashboardModuleGrid, {
      props: {
        modules: [],
      },
    })

    expect(wrapper.get('[data-testid="role-dashboard-empty"]').text()).toContain(
      'No dashboard modules are available',
    )
  })
})

describe('RoleDashboardView', () => {
  it('renders the signed-in user role dashboard modules', () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const auth = useAuthStore()
    const jobs = useJobsStore()
    auth.currentUser = {
      displayName: 'Chris Larsen',
      email: 'chris@example.com',
      uid: 'user-admin',
    }
    auth.profile = {
      active: true,
      assignedJobIds: [],
      email: 'chris@example.com',
      firstName: 'Chris',
      id: 'user-admin',
      lastName: 'Larsen',
      role: 'admin',
    }
    jobs.jobs = [
      {
        active: true,
        assignedForemanIds: [],
        code: '1A',
        gc: 'Phase 2',
        id: 'job-e2e',
        name: 'Phase 2 Company Acoustical remodel',
        notificationRecipients: {
          dailyLogs: [],
          shopOrders: [],
          timecards: [],
        },
        productionBurden: 0.33,
        type: 'general',
      },
    ]
    jobs.subscribeVisibleJobs = vi.fn()
    jobs.stopJobsSubscription = vi.fn()

    const wrapper = mount(RoleDashboardView, {
      global: {
        plugins: [pinia],
        stubs: {
          AppShell: appShellStub,
          RouterLink: routerLinkStub,
        },
      },
    })

    expect(wrapper.get('[data-testid="role-dashboard-page"]').text()).toContain(
      'Welcome, Chris Larsen',
    )
    expect(wrapper.text()).toContain('Open a job or choose a tool below.')
    expect(wrapper.get('[data-testid="role-dashboard-module-users"]').attributes('href')).toBe(
      '/users',
    )
    expect(wrapper.get('[data-testid="role-dashboard-module-shop-catalog"]').attributes('href')).toBe(
      '/settings/shop-catalog',
    )
    expect(wrapper.get('[data-testid="role-dashboard-job-shortcut-job-e2e"]').text()).toContain(
      '1A - Phase 2 Company Acoustical remodel',
    )
    expect(jobs.subscribeVisibleJobs).toHaveBeenCalledOnce()
  })
})
