import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import JobsWorkspaceShell from '@/components/jobs/JobsWorkspaceShell.vue'

const AppShellStub = {
  name: 'AppShell',
  template: '<div data-testid="app-shell"><header><slot name="topbar-actions" /></header><main><slot /></main></div>',
}

const AppButtonStub = {
  name: 'AppButton',
  inheritAttrs: false,
  props: ['variant'],
  emits: ['click'],
  template: `
    <button
      v-bind="$attrs"
      type="button"
      :data-variant="variant"
      @click="$emit('click')"
    >
      <slot />
    </button>
  `,
}

const AppSplitWorkspaceStub = {
  name: 'AppSplitWorkspace',
  inheritAttrs: false,
  props: ['mode'],
  template: `
    <section v-bind="$attrs" data-testid="jobs-workspace" :data-mode="mode">
      <div data-testid="primary-slot"><slot name="primary" /></div>
      <div data-testid="secondary-slot"><slot name="secondary" /></div>
    </section>
  `,
}

function mountShell(overrides: Partial<{ canUseJobSetupEditor: boolean; editMode: boolean }> = {}) {
  return mount(JobsWorkspaceShell, {
    props: {
      canUseJobSetupEditor: true,
      editMode: false,
      ...overrides,
    },
    attrs: {
      class: 'jobs-shell-test',
    },
    slots: {
      primary: '<section data-testid="jobs-browser">Jobs browser</section>',
      secondary: '<section data-testid="jobs-editor">Jobs editor</section>',
      default: '<div data-testid="jobs-dialogs">Jobs dialogs</div>',
    },
    global: {
      stubs: {
        AppButton: AppButtonStub,
        AppShell: AppShellStub,
        AppSplitWorkspace: AppSplitWorkspaceStub,
      },
    },
  })
}

describe('JobsWorkspaceShell', () => {
  it('renders admin edit controls, equal-mode workspace, forwarded attrs, and slots', async () => {
    const wrapper = mountShell({ editMode: true })

    const editButton = wrapper.get('[data-testid="jobs-edit-mode"]')
    expect(editButton.text()).toBe('Done Editing')
    expect(editButton.classes()).toContain('jobs-edit-mode-button')
    expect(editButton.classes()).toContain('jobs-edit-mode-button--active')
    expect(editButton.attributes('aria-pressed')).toBe('true')
    expect(editButton.attributes('data-variant')).toBe('ghost')

    const workspace = wrapper.get('[data-testid="jobs-workspace"]')
    expect(workspace.classes()).toContain('jobs-shell-test')
    expect(workspace.attributes('data-mode')).toBe('equal')
    expect(wrapper.get('[data-testid="primary-slot"]').text()).toContain('Jobs browser')
    expect(wrapper.get('[data-testid="secondary-slot"]').text()).toContain('Jobs editor')
    expect(wrapper.get('[data-testid="jobs-dialogs"]').text()).toBe('Jobs dialogs')

    await editButton.trigger('click')

    expect(wrapper.emitted('toggleEditMode')).toHaveLength(1)
  })

  it('renders single-mode workspace and edit label before edit mode opens', () => {
    const wrapper = mountShell({ editMode: false })

    expect(wrapper.get('[data-testid="jobs-edit-mode"]').text()).toBe('Edit Mode')
    expect(wrapper.get('[data-testid="jobs-edit-mode"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('[data-testid="jobs-workspace"]').attributes('data-mode')).toBe('single')
  })

  it('hides edit controls for users without job setup access', () => {
    const wrapper = mountShell({
      canUseJobSetupEditor: false,
      editMode: true,
    })

    expect(wrapper.find('[data-testid="jobs-edit-mode"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="jobs-workspace"]').attributes('data-mode')).toBe('single')
  })
})
