import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DailyLogPageHeader from '@/components/dailyLogs/DailyLogPageHeader.vue'

function mountPageHeader(overrides: Partial<InstanceType<typeof DailyLogPageHeader>['$props']> = {}) {
  return mount(DailyLogPageHeader, {
    props: {
      canCreateDailyLog: true,
      canEditSelectedLog: true,
      createButtonLabel: 'Create Daily Log',
      creatingDraft: false,
      deletingDraft: false,
      hasUnsavedDraftChanges: true,
      savingDraft: false,
      selectedDate: '2026-06-11',
      selectedDateIsFuture: false,
      selectedDateIsToday: true,
      selectedLogLabel: 'Draft #1',
      submittingLog: false,
      title: 'Phase 2 Company Acoustical remodel',
      visibleLogCount: 2,
      ...overrides,
    },
  })
}

describe('DailyLogPageHeader', () => {
  it('renders page title, toolbar badges, and editable header actions', async () => {
    const wrapper = mountPageHeader()

    expect(wrapper.text()).toContain('Daily Logs')
    expect(wrapper.text()).toContain('Phase 2 Company Acoustical remodel')
    expect(wrapper.text()).toContain('Draft #1')
    expect(wrapper.text()).toContain('2 logs for 2026-06-11')
    expect(wrapper.text()).toContain('Unsaved changes')

    await wrapper.get('button:not(.app-button--primary)').trigger('click')
    await wrapper.get('button.app-button--primary').trigger('click')

    expect(wrapper.emitted('saveDraft')).toHaveLength(1)
    expect(wrapper.emitted('createDraft')).toHaveLength(1)
  })

  it('locks or hides actions based on parent-owned workflow state', () => {
    const submittingWrapper = mountPageHeader({
      submittingLog: true,
    })
    const deletingWrapper = mountPageHeader({
      deletingDraft: true,
    })
    const cleanWrapper = mountPageHeader({
      hasUnsavedDraftChanges: false,
    })
    const readOnlyWrapper = mountPageHeader({
      canCreateDailyLog: false,
      canEditSelectedLog: false,
    })

    expect(submittingWrapper.get('button:not(.app-button--primary)').attributes('disabled')).toBeDefined()
    expect(deletingWrapper.get('button:not(.app-button--primary)').attributes('disabled')).toBeDefined()
    expect(cleanWrapper.get('button:not(.app-button--primary)').attributes('disabled')).toBeDefined()
    expect(readOnlyWrapper.find('button').exists()).toBe(false)
  })

  it('shows loading states and prioritizes saving copy over unsaved-copy', () => {
    const wrapper = mountPageHeader({
      creatingDraft: true,
      savingDraft: true,
    })

    expect(wrapper.text()).toContain('Saving...')
    expect(wrapper.text()).toContain('Creating...')
    expect(wrapper.text()).toContain('Saving draft...')
    expect(wrapper.text()).not.toContain('Unsaved changes')
    expect(wrapper.get('button:not(.app-button--primary)').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('button.app-button--primary').attributes('aria-busy')).toBe('true')
  })

  it('shows view-only guidance for future selected dates', () => {
    const wrapper = mountPageHeader({
      selectedDate: '2026-06-12',
      selectedDateIsFuture: true,
      selectedDateIsToday: false,
    })

    expect(wrapper.text()).toContain('2 logs for 2026-06-12')
    expect(wrapper.text()).toContain('Future daily logs are view only.')
  })

  it('does not show view-only guidance for earlier selected dates', () => {
    const wrapper = mountPageHeader({
      selectedDate: '2026-06-10',
      selectedDateIsFuture: false,
      selectedDateIsToday: false,
    })

    expect(wrapper.text()).toContain('2 logs for 2026-06-10')
    expect(wrapper.text()).not.toContain('view only')
  })
})
