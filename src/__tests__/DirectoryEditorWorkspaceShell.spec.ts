import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DirectoryEditorWorkspaceShell from '@/components/common/DirectoryEditorWorkspaceShell.vue'

const AppShellStub = {
  name: 'AppShell',
  template: '<div data-testid="app-shell"><slot /></div>',
}

const AppSplitWorkspaceStub = {
  name: 'AppSplitWorkspace',
  inheritAttrs: false,
  props: ['activePanel', 'primaryPanel', 'secondaryPanel'],
  template: `
    <section
      v-bind="$attrs"
      data-stub="split-workspace"
      :data-active-panel="activePanel"
      :data-primary-panel="primaryPanel"
      :data-secondary-panel="secondaryPanel"
    >
      <slot name="tabs" />
      <div data-testid="primary-slot"><slot name="primary" /></div>
      <div data-testid="secondary-slot"><slot name="secondary" /></div>
    </section>
  `,
}

const AppMobilePanelTabsStub = {
  name: 'AppMobilePanelTabs',
  props: ['activePanel', 'label', 'panels'],
  emits: ['show'],
  template: `
    <nav data-testid="mobile-tabs" :aria-label="label" :data-active-panel="activePanel">
      <button
        v-for="panel in panels"
        :key="panel.key"
        type="button"
        @click="$emit('show', panel.key)"
      >
        {{ panel.label }}
      </button>
    </nav>
  `,
}

function mountShell() {
  return mount(DirectoryEditorWorkspaceShell, {
    props: {
      activePanel: 'directory',
      panels: [
        { key: 'directory', label: 'Users' },
        { key: 'editor', label: 'Editor' },
      ],
      tabsLabel: 'Users workspace',
    },
    attrs: {
      class: 'users-workspace',
      'data-testid': 'users-page',
    },
    slots: {
      primary: '<section data-testid="directory-panel">Directory panel</section>',
      secondary: '<section data-testid="editor-panel">Editor panel</section>',
      default: '<div data-testid="dialogs">Dialogs</div>',
    },
    global: {
      stubs: {
        AppMobilePanelTabs: AppMobilePanelTabsStub,
        AppShell: AppShellStub,
        AppSplitWorkspace: AppSplitWorkspaceStub,
      },
    },
  })
}

describe('DirectoryEditorWorkspaceShell', () => {
  it('renders the app shell, workspace slots, mobile tabs, and default slot', () => {
    const wrapper = mountShell()

    expect(wrapper.get('[data-testid="app-shell"]').text()).toContain('Directory panel')

    const workspace = wrapper.get('[data-testid="users-page"]')
    expect(workspace.classes()).toContain('users-workspace')
    expect(workspace.attributes('data-active-panel')).toBe('directory')
    expect(workspace.attributes('data-primary-panel')).toBe('directory')
    expect(workspace.attributes('data-secondary-panel')).toBe('editor')

    const tabs = wrapper.get('[data-testid="mobile-tabs"]')
    expect(tabs.attributes('aria-label')).toBe('Users workspace')
    expect(tabs.attributes('data-active-panel')).toBe('directory')
    expect(tabs.text()).toContain('Users')
    expect(tabs.text()).toContain('Editor')

    expect(wrapper.get('[data-testid="primary-slot"]').text()).toContain('Directory panel')
    expect(wrapper.get('[data-testid="secondary-slot"]').text()).toContain('Editor panel')
    expect(wrapper.get('[data-testid="dialogs"]').text()).toBe('Dialogs')
  })

  it('forwards mobile tab selections to the route shell', async () => {
    const wrapper = mountShell()
    await wrapper.findAll('[data-testid="mobile-tabs"] button')[1]?.trigger('click')

    expect(wrapper.emitted('show')).toEqual([['editor']])
  })
})
