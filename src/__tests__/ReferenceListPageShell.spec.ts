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

const ModulePlaceholderStub = {
  name: 'ModulePlaceholder',
  props: ['description', 'eyebrow', 'highlights', 'title'],
  template: `
    <article data-testid="module-placeholder">
      <p data-testid="placeholder-eyebrow">{{ eyebrow }}</p>
      <h2 data-testid="placeholder-title">{{ title }}</h2>
      <p data-testid="placeholder-description">{{ description }}</p>
      <ul>
        <li v-for="highlight in highlights" :key="highlight">{{ highlight }}</li>
      </ul>
    </article>
  `,
}

describe('ReferenceListPageShell', () => {
  it('renders the reference-list scaffold through shared page primitives', () => {
    const wrapper = mount(ReferenceListPageShell, {
      props: {
        title: 'Job Types',
      },
      global: {
        stubs: {
          AppShell: AppShellStub,
          ModulePlaceholder: ModulePlaceholderStub,
          PagePanel: PagePanelStub,
        },
      },
    })

    expect(wrapper.find('[data-testid="app-shell"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reference-list-page"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="panel-eyebrow"]').text()).toBe('Admin')
    expect(wrapper.get('[data-testid="panel-title"]').text()).toBe('Job Types')
    expect(wrapper.get('[data-testid="panel-description"]').text()).toContain(
      'fixed lists are managed by admins',
    )
    expect(wrapper.get('[data-testid="placeholder-eyebrow"]').text()).toBe('Reference Lists')
    expect(wrapper.get('[data-testid="placeholder-title"]').text()).toBe('List management scaffold')
    expect(wrapper.text()).toContain('Job types, GCs, and occupations')
  })
})
