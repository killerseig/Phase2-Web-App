import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import JobDashboardPageShell from '@/components/jobs/JobDashboardPageShell.vue'

const AppShellStub = {
  name: 'AppShell',
  template: '<div data-testid="app-shell"><main><slot /></main></div>',
}

const JobDashboardWorkspaceShellStub = {
  name: 'JobDashboardWorkspaceShell',
  inheritAttrs: false,
  props: ['testId'],
  template: `
    <section v-bind="$attrs" :data-testid="testId" data-shell="job-dashboard-workspace">
      <div data-testid="header-slot"><slot name="header" /></div>
      <div data-testid="modules-slot"><slot name="modules" /></div>
    </section>
  `,
}

describe('JobDashboardPageShell', () => {
  it('composes the app shell, dashboard workspace shell, forwarded attrs, and slots', () => {
    const wrapper = mount(JobDashboardPageShell, {
      props: {
        testId: 'job-dashboard-page',
      },
      attrs: {
        class: 'job-dashboard-page-test',
      },
      slots: {
        header: '<header data-testid="dashboard-header">Header</header>',
        modules: '<section data-testid="dashboard-modules">Modules</section>',
        default: '<div data-testid="dashboard-extra">Extra</div>',
      },
      global: {
        stubs: {
          AppShell: AppShellStub,
          JobDashboardWorkspaceShell: JobDashboardWorkspaceShellStub,
        },
      },
    })

    const workspace = wrapper.get('[data-testid="job-dashboard-page"]')

    expect(wrapper.find('[data-testid="app-shell"]').exists()).toBe(true)
    expect(workspace.classes()).toContain('job-dashboard-page-test')
    expect(workspace.attributes('data-shell')).toBe('job-dashboard-workspace')
    expect(wrapper.get('[data-testid="header-slot"]').text()).toBe('Header')
    expect(wrapper.get('[data-testid="modules-slot"]').text()).toBe('Modules')
    expect(wrapper.get('[data-testid="dashboard-extra"]').text()).toBe('Extra')
  })
})
