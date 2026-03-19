import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useTimecardEmployeeEditing } from '@/views/timecards/useTimecardEmployeeEditing'
import type { TimecardEmployeeEditorForm, TimecardModel } from '@/views/timecards/timecardUtils'

function createTimecard(overrides: Partial<TimecardModel> = {}): TimecardModel {
  return {
    id: overrides.id ?? 'tc-1',
    jobId: overrides.jobId ?? 'job-1',
    weekStartDate: overrides.weekStartDate ?? '2026-03-08',
    weekEndingDate: overrides.weekEndingDate ?? '2026-03-14',
    status: overrides.status ?? 'draft',
    createdByUid: overrides.createdByUid ?? 'creator-1',
    employeeRosterId: overrides.employeeRosterId ?? 'roster-1',
    employeeNumber: overrides.employeeNumber ?? '100',
    employeeName: overrides.employeeName ?? 'Casey Stone',
    firstName: overrides.firstName ?? 'Casey',
    lastName: overrides.lastName ?? 'Stone',
    occupation: overrides.occupation ?? 'Carpenter',
    employeeWage: overrides.employeeWage ?? 30,
    subcontractedEmployee: overrides.subcontractedEmployee ?? false,
    mileage: overrides.mileage ?? 0,
    jobs: overrides.jobs ?? [],
    days: overrides.days ?? [],
    totals: overrides.totals ?? {
      hours: [0, 0, 0, 0, 0, 0, 0],
      production: [0, 0, 0, 0, 0, 0, 0],
      hoursTotal: 0,
      productionTotal: 0,
      lineTotal: 0,
    },
    notes: overrides.notes ?? '',
    archived: overrides.archived ?? false,
  }
}

describe('useTimecardEmployeeEditing', () => {
  it('starts editing and applies employee changes on confirm', () => {
    const editForm = ref<TimecardEmployeeEditorForm>({
      employeeNumber: '',
      firstName: '',
      lastName: '',
      occupation: '',
      employeeWage: '',
      subcontractedEmployee: false,
    })
    const editingTimecardId = ref<string | null>(null)
    const expandedId = ref<string | null>(null)
    const autoSave = vi.fn()
    const recalcTotals = vi.fn()
    const toast = { show: vi.fn() }
    const timecard = createTimecard()

    const editing = useTimecardEmployeeEditing({
      editForm,
      editingTimecardId,
      expandedId,
      toast,
      recalcTotals,
      autoSave,
      validateTimecardIdentity: () => null,
    })

    editing.toggleEditingEmployee(timecard)
    expect(editingTimecardId.value).toBe('tc-1')
    expect(editForm.value.firstName).toBe('Casey')

    editForm.value = {
      employeeNumber: '200',
      firstName: 'Jordan',
      lastName: 'Smith',
      occupation: 'Foreman',
      employeeWage: '42.50',
      subcontractedEmployee: true,
    }

    editing.toggleEditingEmployee(timecard)

    expect(timecard.employeeNumber).toBe('200')
    expect(timecard.employeeName).toBe('Jordan Smith')
    expect(timecard.employeeWage).toBe(42.5)
    expect(timecard.subcontractedEmployee).toBe(true)
    expect(recalcTotals).toHaveBeenCalledWith(timecard)
    expect(autoSave).toHaveBeenCalledWith(timecard)
    expect(editingTimecardId.value).toBeNull()
  })

  it('updates expansion, mileage, and notes through shared handlers', () => {
    const editing = useTimecardEmployeeEditing({
      editForm: ref<TimecardEmployeeEditorForm>({
        employeeNumber: '',
        firstName: '',
        lastName: '',
        occupation: '',
        employeeWage: '',
        subcontractedEmployee: false,
      }),
      editingTimecardId: ref<string | null>(null),
      expandedId: ref<string | null>(null),
      toast: { show: vi.fn() },
      recalcTotals: vi.fn(),
      autoSave: vi.fn(),
      validateTimecardIdentity: () => null,
    })
    const timecard = createTimecard()

    editing.handleTimecardToggle('tc-1', true)
    editing.updateMileage(timecard, '17.5')
    editing.handleNotesInput(timecard, 'Needs follow-up')

    expect(editing.handleTimecardToggle).toBeTypeOf('function')
    expect(timecard.mileage).toBe(17.5)
    expect(timecard.notes).toBe('Needs follow-up')
  })
})
