import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import JobTimecardActionsPanel from '@/components/timecards/JobTimecardActionsPanel.vue'

function mountPanel(overrides = {}) {
  return mount(JobTimecardActionsPanel, {
    props: {
      canCreateSelectedWeek: true,
      actionLoading: false,
      ensuringWeek: false,
      canEditWeek: true,
      hasSelectedWeek: true,
      cardCount: 3,
      showCreateTray: false,
      mobileActive: true,
      ...overrides,
    },
  })
}

function findButton(wrapper: ReturnType<typeof mountPanel>, label: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text() === label)
  if (!button) throw new Error(`Unable to find button "${label}"`)
  return button
}

describe('JobTimecardActionsPanel', () => {
  it('renders workspace action copy and visible create-week action', () => {
    const wrapper = mountPanel()

    expect(wrapper.get('legend').text()).toBe('Workspace Actions')
    expect(wrapper.get('[data-testid="create-week"]').text()).toBe('Create Week')
    expect(wrapper.get('[data-testid="create-card"]').text()).toBe('Create Card')
    expect(wrapper.text()).toContain('Submit Week')
    expect(wrapper.text()).toContain('Expand All')
    expect(wrapper.text()).toContain('Compact All')
  })

  it('updates loading and create-tray button copy from props', () => {
    const wrapper = mountPanel({ ensuringWeek: true, showCreateTray: true })

    expect(wrapper.get('[data-testid="create-week"]').text()).toBe('Opening Week')
    expect(wrapper.get('[data-testid="create-card"]').text()).toBe('Close Create')
  })

  it('hides the create-week action when the selected week cannot be created', () => {
    const wrapper = mountPanel({ canCreateSelectedWeek: false })

    expect(wrapper.find('[data-testid="create-week"]').exists()).toBe(false)
  })

  it('emits workspace action events', async () => {
    const wrapper = mountPanel()

    await wrapper.get('[data-testid="create-week"]').trigger('click')
    await wrapper.get('[data-testid="create-card"]').trigger('click')
    await findButton(wrapper, 'Submit Week').trigger('click')
    await findButton(wrapper, 'Expand All').trigger('click')
    await findButton(wrapper, 'Compact All').trigger('click')

    expect(wrapper.emitted('createWeek')).toHaveLength(1)
    expect(wrapper.emitted('toggleCreateTray')).toHaveLength(1)
    expect(wrapper.emitted('submitWeek')).toHaveLength(1)
    expect(wrapper.emitted('expandAll')).toHaveLength(1)
    expect(wrapper.emitted('compactAll')).toHaveLength(1)
  })

  it('disables actions when the week or cards are not actionable', () => {
    expect(mountPanel({ actionLoading: true }).get('[data-testid="create-week"]').attributes('disabled')).toBeDefined()
    expect(mountPanel({ ensuringWeek: true }).get('[data-testid="create-week"]').attributes('disabled')).toBeDefined()
    expect(mountPanel({ canEditWeek: false }).get('[data-testid="create-card"]').attributes('disabled')).toBeDefined()
    expect(mountPanel({ hasSelectedWeek: false }).get('[data-testid="create-card"]').attributes('disabled')).toBeDefined()
    expect(findButton(mountPanel({ cardCount: 0 }), 'Submit Week').attributes('disabled')).toBeDefined()
    expect(findButton(mountPanel({ cardCount: 0 }), 'Expand All').attributes('disabled')).toBeDefined()
    expect(findButton(mountPanel({ cardCount: 0 }), 'Compact All').attributes('disabled')).toBeDefined()
  })
})
