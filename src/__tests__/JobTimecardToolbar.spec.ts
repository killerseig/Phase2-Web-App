import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import JobTimecardToolbar from '@/components/timecards/JobTimecardToolbar.vue'
import type { TimecardWeekRecord } from '@/types/domain'

function makeWeek(overrides: Partial<TimecardWeekRecord> = {}): TimecardWeekRecord {
  return {
    id: 'week-1',
    jobId: 'job-1',
    jobCode: '736',
    jobName: 'Shop',
    ownerForemanUserId: 'user-1',
    ownerForemanName: 'CJ Blanchard',
    weekStartDate: '2026-06-14',
    weekEndDate: '2026-06-20',
    status: 'draft',
    employeeCardCount: 2,
    ...overrides,
  }
}

const ToolbarTabsStub = {
  name: 'TimecardToolbarTabs',
  props: ['tabs', 'activeKey', 'toolbarLabel', 'tabIdPrefix', 'panelIdPrefix', 'collapseAt'],
  emits: ['select-tab'],
  template: `<nav data-testid="toolbar-tabs"><button type="button" data-testid="emit-tab" @click="$emit('select-tab', 'search')" /></nav>`,
}

const WeekPanelStub = {
  name: 'JobTimecardWeekPanel',
  props: ['displayJobCode', 'displayJobName', 'selectedWeekEndDate', 'mobileActive'],
  emits: ['week-ending-input', 'week-ending-picker-open'],
  template: `
    <section data-testid="week-panel">
      <button type="button" data-testid="emit-week-input" @click="$emit('week-ending-input', { type: 'change' })" />
      <button type="button" data-testid="emit-week-picker" @click="$emit('week-ending-picker-open', { type: 'click' })" />
    </section>
  `,
}

const SearchPanelStub = {
  name: 'JobTimecardSearchPanel',
  props: ['cardSearchTerm', 'mobileActive'],
  emits: ['update-card-search-term'],
  template: `<section data-testid="search-panel"><button type="button" data-testid="emit-search" @click="$emit('update-card-search-term', 'larsen')" /></section>`,
}

const ActionsPanelStub = {
  name: 'JobTimecardActionsPanel',
  props: [
    'canCreateSelectedWeek',
    'actionLoading',
    'ensuringWeek',
    'canEditWeek',
    'hasSelectedWeek',
    'cardCount',
    'showCreateTray',
    'mobileActive',
  ],
  emits: ['create-week', 'toggle-create-tray', 'submit-week', 'expand-all', 'compact-all'],
  template: `
    <section data-testid="actions-panel">
      <button type="button" data-testid="emit-create-week" @click="$emit('create-week')" />
      <button type="button" data-testid="emit-toggle-tray" @click="$emit('toggle-create-tray')" />
      <button type="button" data-testid="emit-submit" @click="$emit('submit-week')" />
      <button type="button" data-testid="emit-expand" @click="$emit('expand-all')" />
      <button type="button" data-testid="emit-compact" @click="$emit('compact-all')" />
    </section>
  `,
}

const SortPanelStub = {
  name: 'JobTimecardSortPanel',
  props: ['sortMode', 'actionLoading', 'canEditWeek', 'cardCount', 'mobileActive'],
  emits: ['update-sort-mode', 'sort-cards'],
  template: `
    <section data-testid="sort-panel">
      <button type="button" data-testid="emit-sort-mode" @click="$emit('update-sort-mode', 'number')" />
      <button type="button" data-testid="emit-sort-cards" @click="$emit('sort-cards')" />
    </section>
  `,
}

const SavedWeeksPanelStub = {
  name: 'JobTimecardSavedWeeksPanel',
  props: ['recentWeeks', 'activeWeekId', 'weeksLoading', 'mobileActive'],
  emits: ['select-week'],
  template: `<section data-testid="saved-weeks-panel"><button type="button" data-testid="emit-select-week" @click="$emit('select-week', recentWeeks[0])" /></section>`,
}

const StatusBarStub = {
  name: 'JobTimecardStatusBar',
  props: ['weekRangeLabel', 'weekStatusLabel', 'selectedWeekSubmitted', 'cardCount', 'saveError', 'saveStateLabel'],
  template: `<section data-testid="status-bar" />`,
}

function mountToolbar(overrides = {}) {
  return mount(JobTimecardToolbar, {
    props: {
      activeMobileTab: 'week',
      displayJobCode: '736',
      displayJobName: 'Shop',
      selectedWeekEndDate: '2026-06-20',
      cardSearchTerm: 'chris',
      canCreateSelectedWeek: true,
      actionLoading: false,
      ensuringWeek: false,
      canEditWeek: true,
      hasSelectedWeek: true,
      cardCount: 3,
      showCreateTray: false,
      sortMode: 'name',
      recentWeeks: [makeWeek(), makeWeek({ id: 'week-2', status: 'submitted' })],
      activeWeekId: 'week-1',
      weeksLoading: false,
      weekRangeLabel: 'Jun 14 - Jun 20',
      weekStatusLabel: 'Draft',
      selectedWeekSubmitted: false,
      saveError: '',
      saveStateLabel: 'Saved',
      ...overrides,
    },
    global: {
      stubs: {
        TimecardToolbarTabs: ToolbarTabsStub,
        JobTimecardWeekPanel: WeekPanelStub,
        JobTimecardSearchPanel: SearchPanelStub,
        JobTimecardActionsPanel: ActionsPanelStub,
        JobTimecardSortPanel: SortPanelStub,
        JobTimecardSavedWeeksPanel: SavedWeeksPanelStub,
        JobTimecardStatusBar: StatusBarStub,
      },
    },
  })
}

describe('JobTimecardToolbar', () => {
  it('forwards toolbar tab state and mobile-active state to child panels', () => {
    const wrapper = mountToolbar({ activeMobileTab: 'actions' })

    expect(wrapper.getComponent({ name: 'TimecardToolbarTabs' }).props()).toMatchObject({
      activeKey: 'actions',
      toolbarLabel: 'Timecard tools',
      tabIdPrefix: 'timecards-toolbar-tab',
      panelIdPrefix: 'timecards-toolbar-panel',
      collapseAt: '900',
    })
    expect(wrapper.getComponent({ name: 'TimecardToolbarTabs' }).props('tabs')).toEqual([
      { key: 'week', label: 'Week' },
      { key: 'search', label: 'Search' },
      { key: 'actions', label: 'Actions' },
      { key: 'sort', label: 'Sort' },
      { key: 'history', label: 'Saved' },
    ])
    expect(wrapper.getComponent({ name: 'JobTimecardWeekPanel' }).props('mobileActive')).toBe(false)
    expect(wrapper.getComponent({ name: 'JobTimecardSearchPanel' }).props('mobileActive')).toBe(false)
    expect(wrapper.getComponent({ name: 'JobTimecardActionsPanel' }).props('mobileActive')).toBe(true)
    expect(wrapper.getComponent({ name: 'JobTimecardSortPanel' }).props('mobileActive')).toBe(false)
    expect(wrapper.getComponent({ name: 'JobTimecardSavedWeeksPanel' }).props('mobileActive')).toBe(false)
  })

  it('forwards route-owned workflow state to the toolbar panels', () => {
    const weeks = [makeWeek({ id: 'selected-week' })]
    const wrapper = mountToolbar({
      recentWeeks: weeks,
      activeWeekId: 'selected-week',
      weeksLoading: true,
      selectedWeekSubmitted: true,
      saveError: 'Unable to save',
      saveStateLabel: 'Save Error',
    })

    expect(wrapper.getComponent({ name: 'JobTimecardWeekPanel' }).props()).toMatchObject({
      displayJobCode: '736',
      displayJobName: 'Shop',
      selectedWeekEndDate: '2026-06-20',
    })
    expect(wrapper.getComponent({ name: 'JobTimecardSearchPanel' }).props()).toMatchObject({
      cardSearchTerm: 'chris',
    })
    expect(wrapper.getComponent({ name: 'JobTimecardActionsPanel' }).props()).toMatchObject({
      canCreateSelectedWeek: true,
      actionLoading: false,
      ensuringWeek: false,
      canEditWeek: true,
      hasSelectedWeek: true,
      cardCount: 3,
      showCreateTray: false,
    })
    expect(wrapper.getComponent({ name: 'JobTimecardSortPanel' }).props()).toMatchObject({
      sortMode: 'name',
      actionLoading: false,
      canEditWeek: true,
      cardCount: 3,
    })
    expect(wrapper.getComponent({ name: 'JobTimecardSavedWeeksPanel' }).props()).toMatchObject({
      recentWeeks: weeks,
      activeWeekId: 'selected-week',
      weeksLoading: true,
    })
    expect(wrapper.getComponent({ name: 'JobTimecardStatusBar' }).props()).toMatchObject({
      weekRangeLabel: 'Jun 14 - Jun 20',
      weekStatusLabel: 'Draft',
      selectedWeekSubmitted: true,
      cardCount: 3,
      saveError: 'Unable to save',
      saveStateLabel: 'Save Error',
    })
  })

  it('forwards child panel events to the parent toolbar contract', async () => {
    const wrapper = mountToolbar()

    await wrapper.get('[data-testid="emit-tab"]').trigger('click')
    await wrapper.get('[data-testid="emit-week-input"]').trigger('click')
    await wrapper.get('[data-testid="emit-week-picker"]').trigger('click')
    await wrapper.get('[data-testid="emit-search"]').trigger('click')
    await wrapper.get('[data-testid="emit-create-week"]').trigger('click')
    await wrapper.get('[data-testid="emit-toggle-tray"]').trigger('click')
    await wrapper.get('[data-testid="emit-submit"]').trigger('click')
    await wrapper.get('[data-testid="emit-expand"]').trigger('click')
    await wrapper.get('[data-testid="emit-compact"]').trigger('click')
    await wrapper.get('[data-testid="emit-sort-mode"]').trigger('click')
    await wrapper.get('[data-testid="emit-sort-cards"]').trigger('click')
    await wrapper.get('[data-testid="emit-select-week"]').trigger('click')

    expect(wrapper.emitted('updateActiveMobileTab')).toEqual([['search']])
    expect(wrapper.emitted('weekEndingInput')).toEqual([[{ type: 'change' }]])
    expect(wrapper.emitted('weekEndingPickerOpen')).toEqual([[{ type: 'click' }]])
    expect(wrapper.emitted('updateCardSearchTerm')).toEqual([['larsen']])
    expect(wrapper.emitted('createWeek')).toHaveLength(1)
    expect(wrapper.emitted('toggleCreateTray')).toHaveLength(1)
    expect(wrapper.emitted('submitWeek')).toHaveLength(1)
    expect(wrapper.emitted('expandAll')).toHaveLength(1)
    expect(wrapper.emitted('compactAll')).toHaveLength(1)
    expect(wrapper.emitted('updateSortMode')).toEqual([['number']])
    expect(wrapper.emitted('sortCards')).toHaveLength(1)
    expect(wrapper.emitted('selectWeek')).toEqual([[makeWeek()]])
  })
})
