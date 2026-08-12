import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppSplitWorkspace from '@/components/common/AppSplitWorkspace.vue'

describe('AppSplitWorkspace', () => {
  it('renders tabs, primary, and secondary slots with the default active panel class', () => {
    const wrapper = mount(AppSplitWorkspace, {
      props: {
        activePanel: 'primary',
      },
      slots: {
        tabs: '<nav data-testid="tabs">Tabs</nav>',
        primary: '<section class="app-split-workspace__primary-pane">Primary pane</section>',
        secondary: '<section class="app-split-workspace__secondary-pane">Secondary pane</section>',
      },
    })

    expect(wrapper.classes()).toContain('app-split-workspace--primary-active')
    expect(wrapper.classes()).not.toContain('app-split-workspace--secondary-active')
    expect(wrapper.get('[data-testid="tabs"]').text()).toBe('Tabs')
    expect(wrapper.text()).toContain('Primary pane')
    expect(wrapper.text()).toContain('Secondary pane')
  })

  it('supports custom panel keys and primary width', () => {
    const wrapper = mount(AppSplitWorkspace, {
      props: {
        activePanel: 'editor',
        primaryPanel: 'directory',
        secondaryPanel: 'editor',
        primaryWidth: '420px',
      },
      attrs: {
        'data-testid': 'workspace',
      },
    })

    expect(wrapper.attributes('data-testid')).toBe('workspace')
    expect(wrapper.classes()).toContain('app-split-workspace--secondary-active')
    expect(wrapper.attributes('style')).toContain('--app-split-workspace-primary-width: 420px')
  })

  it('supports equal and single layout modes without changing the fixed default', () => {
    const defaultWrapper = mount(AppSplitWorkspace)
    const equalWrapper = mount(AppSplitWorkspace, {
      props: {
        mode: 'equal',
      },
    })
    const singleWrapper = mount(AppSplitWorkspace, {
      props: {
        mode: 'single',
      },
    })

    expect(defaultWrapper.classes()).not.toContain('app-split-workspace--equal')
    expect(defaultWrapper.classes()).not.toContain('app-split-workspace--single')
    expect(equalWrapper.classes()).toContain('app-split-workspace--equal')
    expect(singleWrapper.classes()).toContain('app-split-workspace--single')
  })

  it('exposes compact and spacious density variants without changing the default density', () => {
    const defaultWrapper = mount(AppSplitWorkspace)
    const compactWrapper = mount(AppSplitWorkspace, {
      props: {
        density: 'compact',
      },
    })
    const spaciousWrapper = mount(AppSplitWorkspace, {
      props: {
        density: 'spacious',
      },
    })

    expect(defaultWrapper.classes()).not.toContain('app-split-workspace--density-compact')
    expect(defaultWrapper.classes()).not.toContain('app-split-workspace--density-spacious')
    expect(compactWrapper.classes()).toContain('app-split-workspace--density-compact')
    expect(spaciousWrapper.classes()).toContain('app-split-workspace--density-spacious')
  })
})
