import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import JobFieldUserAssignmentPanel from '@/components/jobs/JobFieldUserAssignmentPanel.vue'
import type { UserProfile } from '@/types/domain'

function makeUser(overrides: Partial<UserProfile>): UserProfile {
  return {
    id: 'user-1',
    email: 'user@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'foreman',
    active: true,
    assignedJobIds: [],
    ...overrides,
  }
}

const users = [
  makeUser({
    id: 'dan',
    email: 'dan.larsen@phase2co.com',
    firstName: 'Dan',
    lastName: 'Larsen',
  }),
  makeUser({
    id: 'cj',
    email: 'cj.blanchard@phase2co.com',
    firstName: 'CJ',
    lastName: 'Blanchard',
    active: false,
  }),
  makeUser({
    id: 'unnamed',
    email: null,
    firstName: null,
    lastName: null,
  }),
]

function mountPanel(overrides = {}) {
  return mount(JobFieldUserAssignmentPanel, {
    props: {
      selectedIds: ['cj'],
      users,
      searchTerm: 'cj',
      loading: false,
      rowTestIdPrefix: 'jobs-foreman',
      ...overrides,
    },
  })
}

describe('JobFieldUserAssignmentPanel', () => {
  it('renders selected count, search value, user rows, and fallback labels', () => {
    const wrapper = mountPanel()

    expect(wrapper.text()).toContain('Assigned Field Users')
    expect(wrapper.text()).toContain('1 selected')

    const searchInput = wrapper.get<HTMLInputElement>('input[type="search"]')
    expect(searchInput.element.value).toBe('cj')
    expect(searchInput.attributes('placeholder')).toBe('Search foremen or project managers')

    expect(wrapper.get('[data-testid="jobs-foreman-dan"]').text()).toContain('Dan Larsen')
    expect(wrapper.get('[data-testid="jobs-foreman-dan"]').text()).toContain(
      'dan.larsen@phase2co.com - Active',
    )
    expect(wrapper.get('[data-testid="jobs-foreman-cj"]').text()).toContain('CJ Blanchard')
    expect(wrapper.get('[data-testid="jobs-foreman-cj"]').text()).toContain(
      'cj.blanchard@phase2co.com - Inactive',
    )
    expect(wrapper.get('[data-testid="jobs-foreman-unnamed"]').text()).toContain(
      'Unnamed Field User',
    )
    expect(wrapper.get('[data-testid="jobs-foreman-unnamed"]').text()).toContain(
      'No email - Active',
    )
  })

  it('emits search and toggle events without mutating parent-owned state', async () => {
    const wrapper = mountPanel()

    await wrapper.get('input[type="search"]').setValue('dan')
    await wrapper.get('[data-testid="jobs-foreman-dan"] input[type="checkbox"]').setValue(true)
    await wrapper.get('[data-testid="jobs-foreman-cj"] input[type="checkbox"]').setValue(false)

    expect(wrapper.emitted('updateSearchTerm')).toEqual([['dan']])
    expect(wrapper.emitted('toggleUser')).toEqual([['dan'], ['cj']])
    expect(wrapper.props('selectedIds')).toEqual(['cj'])
  })

  it('marks checked rows from selected ids', () => {
    const wrapper = mountPanel({
      selectedIds: ['dan', 'unnamed'],
    })

    expect(
      wrapper.get<HTMLInputElement>('[data-testid="jobs-foreman-dan"] input[type="checkbox"]')
        .element.checked,
    ).toBe(true)
    expect(
      wrapper.get<HTMLInputElement>('[data-testid="jobs-foreman-cj"] input[type="checkbox"]')
        .element.checked,
    ).toBe(false)
    expect(
      wrapper.get<HTMLInputElement>(
        '[data-testid="jobs-foreman-unnamed"] input[type="checkbox"]',
      ).element.checked,
    ).toBe(true)
  })

  it('renders loading and empty states from parent-owned data state', () => {
    const loadingWrapper = mountPanel({
      loading: true,
    })
    const emptyWrapper = mountPanel({
      selectedIds: [],
      users: [],
      searchTerm: 'missing',
    })

    expect(loadingWrapper.text()).toContain('Loading assignable users...')
    expect(loadingWrapper.find('[data-testid="jobs-foreman-dan"]').exists()).toBe(false)
    expect(emptyWrapper.text()).toContain('0 selected')
    expect(emptyWrapper.text()).toContain('No assignable users match your search.')
  })
})
