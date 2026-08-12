import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TimecardExportToolbar from '@/components/timecards/TimecardExportToolbar.vue'
import type { TimecardExportStatusSignal } from '@/components/timecards/TimecardExportStatusBar.vue'
import type { TimecardToolbarTab } from '@/components/timecards/TimecardToolbarTabs.vue'
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

const tabs: TimecardToolbarTab[] = [
  { key: 'weeks', label: 'Weeks' },
  { key: 'archive', label: 'Archive' },
  { key: 'sort', label: 'Sort' },
  { key: 'actions', label: 'Actions' },
  { key: 'saved', label: 'Saved' },
]

const filters = {
  dateMode: 'single' as const,
  singleWeekEndDate: '2026-06-20',
  rangeStartDate: '2026-06-01',
  rangeEndDate: '2026-06-30',
  selectedJobIds: ['job-1'],
  foreman: 'user-1',
  status: 'draft' as const,
  weekSearch: 'shop',
  cardSearch: 'chris',
}

const statusSignals: TimecardExportStatusSignal[] = [
  { key: 'weeks', text: '2 weeks', tone: 'default' },
  { key: 'saved', text: 'Saved', tone: 'success' },
]

const ToolbarTabsStub = {
  name: 'TimecardToolbarTabs',
  props: ['tabs', 'activeKey', 'toolbarLabel', 'tabIdPrefix', 'panelIdPrefix', 'collapseAt'],
  emits: ['select-tab'],
  template: `<nav data-testid="toolbar-tabs"><button type="button" data-testid="emit-tab" @click="$emit('select-tab', 'archive')" /></nav>`,
}

const WeekFiltersStub = {
  name: 'TimecardExportWeekFiltersPanel',
  props: ['filters', 'dateModeOptions', 'mobileActive'],
  emits: ['update-filter'],
  template: `<section data-testid="week-filters"><button type="button" data-testid="emit-week-filter" @click="$emit('update-filter', 'weekSearch', 'lucky')" /></section>`,
}

const ArchiveFiltersStub = {
  name: 'TimecardExportArchiveFiltersPanel',
  props: ['filters', 'availableJobOptions', 'availableForemanOptions', 'weekStatusOptions', 'mobileActive'],
  emits: ['update-filter'],
  template: `<section data-testid="archive-filters"><button type="button" data-testid="emit-archive-filter" @click="$emit('update-filter', 'selectedJobIds', ['job-2'])" /></section>`,
}

const SortPanelStub = {
  name: 'TimecardExportSortPanel',
  props: ['sortMode', 'cardSearch', 'mobileActive'],
  emits: ['update-sort-mode', 'update-card-search'],
  template: `
    <section data-testid="sort-panel">
      <button type="button" data-testid="emit-sort-mode" @click="$emit('update-sort-mode', 'number')" />
      <button type="button" data-testid="emit-card-search" @click="$emit('update-card-search', 'vince')" />
    </section>
  `,
}

const ActionsPanelStub = {
  name: 'TimecardExportActionsPanel',
  props: ['canUseTimecardExport', 'actionLoading', 'showCreateTray', 'mobileActive'],
  emits: ['set-all-cards-compact', 'export-pdf', 'export-csv', 'toggle-create-tray'],
  template: `
    <section data-testid="actions-panel">
      <button type="button" data-testid="emit-expand" @click="$emit('set-all-cards-compact', false)" />
      <button type="button" data-testid="emit-compact" @click="$emit('set-all-cards-compact', true)" />
      <button type="button" data-testid="emit-pdf" @click="$emit('export-pdf')" />
      <button type="button" data-testid="emit-csv" @click="$emit('export-csv')" />
      <button type="button" data-testid="emit-create-tray" @click="$emit('toggle-create-tray')" />
    </section>
  `,
}

const SavedWeeksStub = {
  name: 'TimecardExportSavedWeeksPanel',
  props: ['weeks', 'weeksLoading', 'canUseTimecardExport', 'actionLoading', 'mobileActive', 'formatDate', 'formatSubtitle'],
  emits: ['delete-week', 'reopen-week', 'submit-week'],
  template: `
    <section data-testid="saved-weeks">
      <button type="button" data-testid="emit-delete-week" @click="$emit('delete-week', weeks[0])" />
      <button type="button" data-testid="emit-reopen-week" @click="$emit('reopen-week', weeks[1])" />
      <button type="button" data-testid="emit-submit-week" @click="$emit('submit-week', weeks[0])" />
    </section>
  `,
}

const StatusBarStub = {
  name: 'TimecardExportStatusBar',
  props: ['signals'],
  template: `<section data-testid="status-bar" />`,
}

function formatDate(value: string) {
  return `formatted ${value}`
}

function formatWeekSubtitle(week: TimecardWeekRecord) {
  return `${week.jobCode} / ${week.ownerForemanName}`
}

function mountToolbar(overrides = {}) {
  return mount(TimecardExportToolbar, {
    props: {
      tabs,
      activeMobileToolbarTab: 'weeks',
      filters,
      dateModeOptions: [
        { label: 'Single', value: 'single' },
        { label: 'Range', value: 'range' },
      ],
      availableJobOptions: [{ id: 'job-1', code: '736', name: 'Shop', label: '736 - Shop' }],
      availableForemanOptions: [{ label: 'CJ Blanchard', value: 'user-1' }],
      weekStatusOptions: [
        { label: 'Draft', value: 'draft' },
        { label: 'Submitted', value: 'submitted' },
        { label: 'All', value: 'all' },
      ],
      sortMode: 'name',
      canUseTimecardExport: true,
      actionLoading: false,
      showCreateTray: false,
      filteredWeeks: [makeWeek(), makeWeek({ id: 'week-2', status: 'submitted' })],
      weeksLoading: false,
      statusSignals,
      formatDate,
      formatWeekSubtitle,
      ...overrides,
    },
    global: {
      stubs: {
        TimecardToolbarTabs: ToolbarTabsStub,
        TimecardExportWeekFiltersPanel: WeekFiltersStub,
        TimecardExportArchiveFiltersPanel: ArchiveFiltersStub,
        TimecardExportSortPanel: SortPanelStub,
        TimecardExportActionsPanel: ActionsPanelStub,
        TimecardExportSavedWeeksPanel: SavedWeeksStub,
        TimecardExportStatusBar: StatusBarStub,
      },
    },
  })
}

describe('TimecardExportToolbar', () => {
  it('forwards tab definitions and mobile-active state to export panels', () => {
    const wrapper = mountToolbar({ activeMobileToolbarTab: 'saved' })

    expect(wrapper.getComponent({ name: 'TimecardToolbarTabs' }).props()).toMatchObject({
      tabs,
      activeKey: 'saved',
      toolbarLabel: 'Timecard export tools',
      tabIdPrefix: 'timecard-export-tab',
      panelIdPrefix: 'timecard-export-panel',
      collapseAt: '960',
    })
    expect(wrapper.getComponent({ name: 'TimecardExportWeekFiltersPanel' }).props('mobileActive')).toBe(false)
    expect(wrapper.getComponent({ name: 'TimecardExportArchiveFiltersPanel' }).props('mobileActive')).toBe(false)
    expect(wrapper.getComponent({ name: 'TimecardExportSortPanel' }).props('mobileActive')).toBe(false)
    expect(wrapper.getComponent({ name: 'TimecardExportActionsPanel' }).props('mobileActive')).toBe(false)
    expect(wrapper.getComponent({ name: 'TimecardExportSavedWeeksPanel' }).props('mobileActive')).toBe(true)
  })

  it('forwards route-owned filters, options, action state, saved weeks, formatters, and status signals', () => {
    const weeks = [makeWeek({ id: 'selected-week' })]
    const wrapper = mountToolbar({
      activeMobileToolbarTab: 'archive',
      filteredWeeks: weeks,
      weeksLoading: true,
      actionLoading: true,
      showCreateTray: true,
      canUseTimecardExport: false,
    })

    expect(wrapper.getComponent({ name: 'TimecardExportWeekFiltersPanel' }).props()).toMatchObject({
      filters,
      dateModeOptions: [
        { label: 'Single', value: 'single' },
        { label: 'Range', value: 'range' },
      ],
    })
    expect(wrapper.getComponent({ name: 'TimecardExportArchiveFiltersPanel' }).props()).toMatchObject({
      filters,
      availableJobOptions: [{ id: 'job-1', code: '736', name: 'Shop', label: '736 - Shop' }],
      availableForemanOptions: [{ label: 'CJ Blanchard', value: 'user-1' }],
      weekStatusOptions: [
        { label: 'Draft', value: 'draft' },
        { label: 'Submitted', value: 'submitted' },
        { label: 'All', value: 'all' },
      ],
      mobileActive: true,
    })
    expect(wrapper.getComponent({ name: 'TimecardExportSortPanel' }).props()).toMatchObject({
      sortMode: 'name',
      cardSearch: 'chris',
    })
    expect(wrapper.getComponent({ name: 'TimecardExportActionsPanel' }).props()).toMatchObject({
      canUseTimecardExport: false,
      actionLoading: true,
      showCreateTray: true,
    })
    expect(wrapper.getComponent({ name: 'TimecardExportSavedWeeksPanel' }).props()).toMatchObject({
      weeks,
      weeksLoading: true,
      canUseTimecardExport: false,
      actionLoading: true,
    })
    expect(wrapper.getComponent({ name: 'TimecardExportSavedWeeksPanel' }).props('formatDate')('2026-06-20')).toBe('formatted 2026-06-20')
    expect(wrapper.getComponent({ name: 'TimecardExportSavedWeeksPanel' }).props('formatSubtitle')(weeks[0])).toBe('736 / CJ Blanchard')
    expect(wrapper.getComponent({ name: 'TimecardExportStatusBar' }).props('signals')).toEqual(statusSignals)
  })

  it('forwards export toolbar events to the parent contract', async () => {
    const wrapper = mountToolbar()

    await wrapper.get('[data-testid="emit-tab"]').trigger('click')
    await wrapper.get('[data-testid="emit-week-filter"]').trigger('click')
    await wrapper.get('[data-testid="emit-archive-filter"]').trigger('click')
    await wrapper.get('[data-testid="emit-sort-mode"]').trigger('click')
    await wrapper.get('[data-testid="emit-card-search"]').trigger('click')
    await wrapper.get('[data-testid="emit-expand"]').trigger('click')
    await wrapper.get('[data-testid="emit-compact"]').trigger('click')
    await wrapper.get('[data-testid="emit-pdf"]').trigger('click')
    await wrapper.get('[data-testid="emit-csv"]').trigger('click')
    await wrapper.get('[data-testid="emit-create-tray"]').trigger('click')
    await wrapper.get('[data-testid="emit-delete-week"]').trigger('click')
    await wrapper.get('[data-testid="emit-reopen-week"]').trigger('click')
    await wrapper.get('[data-testid="emit-submit-week"]').trigger('click')

    expect(wrapper.emitted('selectMobileTab')).toEqual([['archive']])
    expect(wrapper.emitted('updateFilter')).toEqual([
      ['weekSearch', 'lucky'],
      ['selectedJobIds', ['job-2']],
      ['cardSearch', 'vince'],
    ])
    expect(wrapper.emitted('updateSortMode')).toEqual([['number']])
    expect(wrapper.emitted('setAllCardsCompact')).toEqual([[false], [true]])
    expect(wrapper.emitted('exportPdf')).toHaveLength(1)
    expect(wrapper.emitted('exportCsv')).toHaveLength(1)
    expect(wrapper.emitted('toggleCreateTray')).toHaveLength(1)
    expect(wrapper.emitted('deleteWeek')).toEqual([[makeWeek()]])
    expect(wrapper.emitted('reopenWeek')).toEqual([[makeWeek({ id: 'week-2', status: 'submitted' })]])
    expect(wrapper.emitted('submitWeek')).toEqual([[makeWeek()]])
  })
})
