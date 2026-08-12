import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DailyLogPageShell from '@/components/dailyLogs/DailyLogPageShell.vue'

const AppShellStub = {
  name: 'AppShell',
  template: '<div data-testid="app-shell"><main><slot /></main></div>',
}

const DailyLogWorkspaceShellStub = {
  name: 'DailyLogWorkspaceShell',
  inheritAttrs: false,
  props: ['testId'],
  template: `
    <section v-bind="$attrs" :data-testid="testId" data-shell="daily-log-workspace">
      <div data-testid="header-slot"><slot name="header" /></div>
      <div data-testid="main-slot"><slot name="main" /></div>
      <div data-testid="sidebar-slot"><slot name="sidebar" /></div>
    </section>
  `,
}

describe('DailyLogPageShell', () => {
  it('composes the app shell, workspace shell, forwarded attrs, named slots, and default slot', () => {
    const wrapper = mount(DailyLogPageShell, {
      props: {
        testId: 'daily-logs-page',
      },
      attrs: {
        class: 'daily-log-page-test',
      },
      slots: {
        header: '<header data-testid="daily-log-header">Header</header>',
        main: '<main data-testid="daily-log-main">Main</main>',
        sidebar: '<aside data-testid="daily-log-sidebar">Sidebar</aside>',
        default: '<div data-testid="daily-log-dialogs">Dialogs</div>',
      },
      global: {
        stubs: {
          AppShell: AppShellStub,
          DailyLogWorkspaceShell: DailyLogWorkspaceShellStub,
        },
      },
    })

    const workspace = wrapper.get('[data-testid="daily-logs-page"]')

    expect(wrapper.find('[data-testid="app-shell"]').exists()).toBe(true)
    expect(workspace.classes()).toContain('daily-log-page-test')
    expect(workspace.attributes('data-shell')).toBe('daily-log-workspace')
    expect(wrapper.get('[data-testid="header-slot"]').text()).toBe('Header')
    expect(wrapper.get('[data-testid="main-slot"]').text()).toBe('Main')
    expect(wrapper.get('[data-testid="sidebar-slot"]').text()).toBe('Sidebar')
    expect(wrapper.get('[data-testid="daily-log-dialogs"]').text()).toBe('Dialogs')
  })
})
