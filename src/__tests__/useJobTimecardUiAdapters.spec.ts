import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useJobTimecardConfirmDialog } from '@/features/timecards/useJobTimecardConfirmDialog'
import { useJobTimecardCreateTray } from '@/features/timecards/useJobTimecardCreateTray'

describe('useJobTimecardCreateTray', () => {
  it('owns create-tray visibility, employee search, and custom-card form resets', () => {
    const createTray = useJobTimecardCreateTray()

    expect(createTray.showCreateTray.value).toBe(false)
    expect(createTray.employeeSearchTerm.value).toBe('')
    expect(createTray.customCardForm).toEqual({
      employeeNumber: '',
      firstName: '',
      isContractor: false,
      lastName: '',
      occupation: '',
      wageRate: '',
    })

    createTray.toggleCreateTray()
    createTray.employeeSearchTerm.value = 'blanchard'
    createTray.customCardForm.firstName = 'CJ'
    createTray.customCardForm.lastName = 'Blanchard'
    createTray.customCardForm.employeeNumber = '5133'
    createTray.customCardForm.occupation = 'Foreman'
    createTray.customCardForm.wageRate = '42.50'
    createTray.customCardForm.isContractor = true

    expect(createTray.showCreateTray.value).toBe(true)

    createTray.resetCustomCardForm()

    expect(createTray.customCardForm).toEqual({
      employeeNumber: '',
      firstName: '',
      isContractor: false,
      lastName: '',
      occupation: '',
      wageRate: '',
    })
    expect(createTray.employeeSearchTerm.value).toBe('blanchard')

    createTray.closeCreateTray()
    expect(createTray.showCreateTray.value).toBe(false)
  })
})

describe('useJobTimecardConfirmDialog', () => {
  it('adapts remove-card confirmations to job Timecard copy', () => {
    const dialog = useJobTimecardConfirmDialog(ref(false))

    dialog.timecardConfirmAction.value = {
      cardId: 'card-1',
      cardLabel: 'Blanchard, CJ',
      kind: 'remove-card',
      weekId: 'week-1',
    }

    expect(dialog.timecardConfirmTitle.value).toBe('Delete timecard?')
    expect(dialog.timecardConfirmMessage.value).toBe(
      'Remove Blanchard, CJ from this week? This cannot be undone.',
    )
    expect(dialog.timecardConfirmLabel.value).toBe('Delete Card')
    expect(dialog.timecardConfirmDestructive.value).toBe(true)

    dialog.handleTimecardConfirmOpenUpdate(false)
    expect(dialog.timecardConfirmAction.value).toBeNull()
  })

  it('adapts submit-week confirmations and does not close while an action is busy', () => {
    const isBusy = ref(true)
    const dialog = useJobTimecardConfirmDialog(isBusy)

    dialog.timecardConfirmAction.value = {
      kind: 'submit-week',
      weekEndDate: '6/20/2026',
      weekId: 'week-1',
    }

    expect(dialog.timecardConfirmTitle.value).toBe('Submit week?')
    expect(dialog.timecardConfirmMessage.value).toBe(
      'Submit the week ending 6/20/2026? Timecards will become read-only after submission.',
    )
    expect(dialog.timecardConfirmLabel.value).toBe('Submit Week')
    expect(dialog.timecardConfirmDestructive.value).toBe(false)

    dialog.handleTimecardConfirmOpenUpdate(false)
    expect(dialog.timecardConfirmAction.value).not.toBeNull()

    isBusy.value = false
    dialog.handleTimecardConfirmOpenUpdate(false)
    expect(dialog.timecardConfirmAction.value).toBeNull()
  })
})
