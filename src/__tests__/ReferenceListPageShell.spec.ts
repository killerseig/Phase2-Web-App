import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ReferenceListPageShell from '@/components/referenceLists/ReferenceListPageShell.vue'

const AppShellStub = {
  name: 'AppShell',
  template: '<div data-testid="app-shell"><main><slot /></main></div>',
}

const PagePanelStub = {
  name: 'PagePanel',
  props: ['description', 'eyebrow', 'title'],
  template: `
    <section data-testid="page-panel">
      <p data-testid="panel-eyebrow">{{ eyebrow }}</p>
      <h1 data-testid="panel-title">{{ title }}</h1>
      <p data-testid="panel-description">{{ description }}</p>
      <slot />
    </section>
  `,
}

describe('ReferenceListPageShell', () => {
  it('renders the shared page layout and list availability', () => {
    const wrapper = mount(ReferenceListPageShell, {
      props: {
        title: 'Job Types',
      },
      global: {
        stubs: {
          AppShell: AppShellStub,
          PagePanel: PagePanelStub,
        },
      },
    })

    expect(wrapper.find('[data-testid="app-shell"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reference-list-page"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="panel-eyebrow"]').text()).toBe('Admin')
    expect(wrapper.get('[data-testid="panel-title"]').text()).toBe('Job Types')
    expect(wrapper.get('[data-testid="panel-description"]').text()).toContain(
      'Shared choices used in jobs, employee records, and forms.',
    )
    expect(wrapper.text()).toContain('List editing is not available yet.')
  })
})
