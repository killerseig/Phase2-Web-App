import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DailyLogWorkspaceShell from '@/components/dailyLogs/DailyLogWorkspaceShell.vue'

describe('DailyLogWorkspaceShell', () => {
  it('renders header, main, and sidebar slots in the daily-log workspace shell', () => {
    const wrapper = mount(DailyLogWorkspaceShell, {
      props: {
        testId: 'daily-logs-page',
      },
      slots: {
        header: '<header data-testid="daily-log-header">Header</header>',
        main: '<main data-testid="daily-log-main">Main</main>',
        sidebar: '<aside data-testid="daily-log-sidebar">Sidebar</aside>',
      },
    })

    const page = wrapper.get('[data-testid="daily-logs-page"]')

    expect(page.classes()).toContain('daily-log-workspace')
    expect(wrapper.find('.daily-log-workspace__layout').exists()).toBe(true)
    expect(wrapper.get('[data-testid="daily-log-header"]').text()).toBe('Header')
    expect(wrapper.get('[data-testid="daily-log-main"]').text()).toBe('Main')
    expect(wrapper.get('[data-testid="daily-log-sidebar"]').text()).toBe('Sidebar')
  })
})
