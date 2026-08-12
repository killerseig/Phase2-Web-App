import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TimecardExportActionsPanel from '@/components/timecards/TimecardExportActionsPanel.vue'

const TimecardButtonStub = {
  props: ['variant', 'disabled'],
  emits: ['click'],
  template: `
    <button
      type="button"
      :data-variant="variant"
      :disabled="disabled"
      @click="$emit('click')"
    >
      <slot />
    </button>
  `,
}

function mountPanel(overrides = {}) {
  return mount(TimecardExportActionsPanel, {
    props: {
      canUseTimecardExport: true,
      actionLoading: false,
      showCreateTray: false,
      mobileActive: true,
      ...overrides,
    },
    global: {
      stubs: {
        TimecardButton: TimecardButtonStub,
      },
    },
  })
}

describe('TimecardExportActionsPanel', () => {
  it('renders workspace action copy and primary export buttons', () => {
    const wrapper = mountPanel()
    const buttons = wrapper.findAll('button')

    expect(wrapper.get('legend').text()).toBe('Workspace Actions')
    expect(buttons.map((button) => button.text())).toEqual([
      'Expand All',
      'Compact All',
      'Export PDF',
      'Export CSV',
      'Create Card',
    ])
    expect(buttons[2]!.attributes('data-variant')).toBe('primary')
    expect(buttons[3]!.attributes('data-variant')).toBe('primary')
  })

  it('emits all workspace actions', async () => {
    const wrapper = mountPanel()
    const buttons = wrapper.findAll('button')

    await buttons[0]!.trigger('click')
    await buttons[1]!.trigger('click')
    await buttons[2]!.trigger('click')
    await buttons[3]!.trigger('click')
    await buttons[4]!.trigger('click')

    expect(wrapper.emitted('setAllCardsCompact')?.[0]).toEqual([false])
    expect(wrapper.emitted('setAllCardsCompact')?.[1]).toEqual([true])
    expect(wrapper.emitted('exportPdf')).toHaveLength(1)
    expect(wrapper.emitted('exportCsv')).toHaveLength(1)
    expect(wrapper.emitted('toggleCreateTray')).toHaveLength(1)
  })

  it('hides or disables create-card action based on permissions and loading state', () => {
    const hiddenWrapper = mountPanel({ canUseTimecardExport: false })
    const disabledWrapper = mountPanel({ actionLoading: true, showCreateTray: true })
    const disabledButtons = disabledWrapper.findAll('button')

    expect(hiddenWrapper.text()).not.toContain('Create Card')
    expect(disabledWrapper.text()).toContain('Close Create')
    expect(disabledButtons[4]!.attributes('disabled')).toBeDefined()
  })
})
