import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import TimecardPageShell from '@/components/timecards/TimecardPageShell.vue'
import TimecardExportPageShell from '@/components/timecards/TimecardExportPageShell.vue'

const AppShellStub = {
  name: 'AppShell',
  props: ['beforeSignOut'],
  template: '<div data-testid="app-shell"><main><slot /></main></div>',
}

const TimecardWorkspaceShellStub = {
  name: 'TimecardWorkspaceShell',
  inheritAttrs: false,
  props: ['testId'],
  template: `
    <section v-bind="$attrs" :data-testid="testId" data-shell="timecard-workspace">
      <slot />
    </section>
  `,
}

describe('TimecardPageShell', () => {
  it.each([TimecardPageShell, TimecardExportPageShell])('forwards sign-out preparation to the app shell', (component) => {
    const prepare = vi.fn<() => Promise<boolean>>().mockResolvedValue(false)
    const wrapper = mount(component, { attrs: { beforeSignOut: prepare }, global: { stubs: { AppShell: AppShellStub } } })
    expect(wrapper.getComponent(AppShellStub).props('beforeSignOut')).toBe(prepare)
    wrapper.unmount()
  })
  it('composes the app shell, timecard workspace shell, forwarded attrs, and dialog slot', () => {
    const wrapper = mount(TimecardPageShell, {
      props: {
        testId: 'timecards-page',
      },
      attrs: {
        class: 'timecard-page-test',
      },
      slots: {
        workspace: '<section data-testid="timecard-workspace-content">Workspace</section>',
        default: '<div data-testid="timecard-dialogs">Dialogs</div>',
      },
      global: {
        stubs: {
          AppShell: AppShellStub,
          TimecardWorkspaceShell: TimecardWorkspaceShellStub,
        },
      },
    })

    const workspace = wrapper.get('[data-testid="timecards-page"]')

    expect(wrapper.find('[data-testid="app-shell"]').exists()).toBe(true)
    expect(workspace.classes()).toContain('timecard-page-test')
    expect(workspace.attributes('data-shell')).toBe('timecard-workspace')
    expect(wrapper.get('[data-testid="timecard-workspace-content"]').text()).toBe('Workspace')
    expect(wrapper.get('[data-testid="timecard-dialogs"]').text()).toBe('Dialogs')
  })
})
