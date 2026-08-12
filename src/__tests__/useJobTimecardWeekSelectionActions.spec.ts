import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useJobTimecardWeekSelectionActions } from '@/features/timecards/useJobTimecardWeekSelectionActions'
import type { TimecardWeekRecord } from '@/types/domain'

function makeWeek(overrides: Partial<TimecardWeekRecord> = {}): TimecardWeekRecord {
  return {
    id: 'week-1',
    employeeCardCount: 0,
    jobCode: '5229',
    jobId: 'job-1',
    jobName: 'Lucky 3 Ranch',
    ownerForemanName: 'Vince Hintz',
    ownerForemanUserId: 'user-1',
    status: 'draft',
    weekEndDate: '2026-06-20',
    weekStartDate: '2026-06-14',
    ...overrides,
  }
}

function makeInputEvent(value: string) {
  const input = document.createElement('input')
  input.value = value
  const event = new Event('input')
  Object.defineProperty(event, 'target', {
    configurable: true,
    value: input,
  })
  return event
}

function mountActions(options: {
  selectedWeekEndDate?: string
  selectedWeekId?: string | null
} = {}) {
  const calls: string[] = []
  const selectedWeekEndDate = ref(options.selectedWeekEndDate ?? '')
  const selectedWeekId = ref<string | null>(options.selectedWeekId ?? null)
  const closeCreateTray = vi.fn(() => {
    calls.push('close')
  })
  const flushPendingSaves = vi.fn(async () => {
    calls.push('flush')
  })

  const actions = useJobTimecardWeekSelectionActions({
    closeCreateTray,
    flushPendingSaves,
    selectedWeekEndDate,
    selectedWeekId,
  })

  return {
    actions,
    calls,
    closeCreateTray,
    flushPendingSaves,
    selectedWeekEndDate,
    selectedWeekId,
  }
}

describe('useJobTimecardWeekSelectionActions', () => {
  it('switches weeks only after pending saves flush and the create tray closes', async () => {
    const {
      actions,
      calls,
      closeCreateTray,
      flushPendingSaves,
      selectedWeekEndDate,
      selectedWeekId,
    } = mountActions({
      selectedWeekEndDate: '2026-06-13',
      selectedWeekId: 'week-old',
    })

    await actions.handleSelectWeek(makeWeek({
      id: 'week-new',
      weekEndDate: '2026-06-20',
    }))

    expect(flushPendingSaves).toHaveBeenCalledTimes(1)
    expect(closeCreateTray).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['flush', 'close'])
    expect(selectedWeekId.value).toBe('week-new')
    expect(selectedWeekEndDate.value).toBe('2026-06-20')
  })

  it('ignores selecting the already selected week without flushing saves', async () => {
    const {
      actions,
      closeCreateTray,
      flushPendingSaves,
      selectedWeekEndDate,
      selectedWeekId,
    } = mountActions({
      selectedWeekEndDate: '2026-06-20',
      selectedWeekId: 'week-1',
    })

    await actions.handleSelectWeek(makeWeek({
      id: 'week-1',
      weekEndDate: '2026-06-27',
    }))

    expect(flushPendingSaves).not.toHaveBeenCalled()
    expect(closeCreateTray).not.toHaveBeenCalled()
    expect(selectedWeekId.value).toBe('week-1')
    expect(selectedWeekEndDate.value).toBe('2026-06-20')
  })

  it('snaps typed dates to Saturday, clears explicit week selection, and flushes before updating', async () => {
    const {
      actions,
      closeCreateTray,
      flushPendingSaves,
      selectedWeekEndDate,
      selectedWeekId,
    } = mountActions({
      selectedWeekEndDate: '2026-06-13',
      selectedWeekId: 'week-1',
    })

    await actions.handleWeekEndingInput(makeInputEvent('2026-06-17'))

    expect(flushPendingSaves).toHaveBeenCalledTimes(1)
    expect(closeCreateTray).toHaveBeenCalledTimes(1)
    expect(selectedWeekId.value).toBeNull()
    expect(selectedWeekEndDate.value).toBe('2026-06-20')
  })

  it('keeps a same-date typed value as a no-op only when no explicit week is selected', async () => {
    const noSelection = mountActions({
      selectedWeekEndDate: '2026-06-20',
      selectedWeekId: null,
    })

    await noSelection.actions.handleWeekEndingInput(makeInputEvent('2026-06-20'))

    expect(noSelection.flushPendingSaves).not.toHaveBeenCalled()
    expect(noSelection.closeCreateTray).not.toHaveBeenCalled()
    expect(noSelection.selectedWeekEndDate.value).toBe('2026-06-20')

    const withSelection = mountActions({
      selectedWeekEndDate: '2026-06-20',
      selectedWeekId: 'week-1',
    })

    await withSelection.actions.handleWeekEndingInput(makeInputEvent('2026-06-20'))

    expect(withSelection.flushPendingSaves).toHaveBeenCalledTimes(1)
    expect(withSelection.closeCreateTray).toHaveBeenCalledTimes(1)
    expect(withSelection.selectedWeekId.value).toBeNull()
    expect(withSelection.selectedWeekEndDate.value).toBe('2026-06-20')
  })

  it('clears the selected week date from blank input', async () => {
    const {
      actions,
      selectedWeekEndDate,
      selectedWeekId,
    } = mountActions({
      selectedWeekEndDate: '2026-06-20',
      selectedWeekId: 'week-1',
    })

    await actions.handleWeekEndingInput(makeInputEvent(''))

    expect(selectedWeekId.value).toBeNull()
    expect(selectedWeekEndDate.value).toBe('')
  })

  it('opens the native date picker when the browser exposes showPicker', () => {
    const { actions } = mountActions()
    const input = document.createElement('input')
    const showPicker = vi.fn()
    Object.defineProperty(input, 'showPicker', {
      configurable: true,
      value: showPicker,
    })
    const event = new Event('click')
    Object.defineProperty(event, 'currentTarget', {
      configurable: true,
      value: input,
    })

    actions.handleWeekEndingPickerOpen(event)

    expect(showPicker).toHaveBeenCalledTimes(1)
  })

  it('ignores date picker open events from non-input targets or browsers without showPicker', () => {
    const { actions } = mountActions()
    const divEvent = new Event('click')
    Object.defineProperty(divEvent, 'currentTarget', {
      configurable: true,
      value: document.createElement('div'),
    })

    expect(() => actions.handleWeekEndingPickerOpen(divEvent)).not.toThrow()

    const inputEvent = new Event('click')
    Object.defineProperty(inputEvent, 'currentTarget', {
      configurable: true,
      value: document.createElement('input'),
    })

    expect(() => actions.handleWeekEndingPickerOpen(inputEvent)).not.toThrow()
  })
})
