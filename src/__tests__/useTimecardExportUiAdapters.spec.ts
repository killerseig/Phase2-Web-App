import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useTimecardExportConfirmDialog } from '@/features/timecards/useTimecardExportConfirmDialog'
import { useTimecardExportCreateTray } from '@/features/timecards/useTimecardExportCreateTray'
import { useTimecardExportUiState } from '@/features/timecards/useTimecardExportUiState'

describe('useTimecardExportUiState', () => {
  it('tracks mobile toolbar tab selection while ignoring unknown tab keys', () => {
    const uiState = useTimecardExportUiState(ref(true))

    expect(uiState.activeMobileToolbarTab.value).toBe('weeks')

    uiState.selectMobileToolbarTab('archive')
    expect(uiState.activeMobileToolbarTab.value).toBe('archive')

    uiState.selectMobileToolbarTab('not-a-tab')
    expect(uiState.activeMobileToolbarTab.value).toBe('archive')
  })

  it('gates card edit state by export edit permission', () => {
    const canEditWeek = ref(true)
    const uiState = useTimecardExportUiState(canEditWeek)

    uiState.setCardEditMode('card-1', true)
    expect(uiState.isCardEditable('card-1')).toBe(true)
    expect(uiState.isCardReadOnly('card-1')).toBe(false)

    uiState.toggleCardEditMode('card-1')
    expect(uiState.isCardEditable('card-1')).toBe(false)

    uiState.toggleCardEditMode('card-2')
    expect(uiState.isCardEditable('card-2')).toBe(true)

    canEditWeek.value = false
    expect(uiState.isCardEditable('card-2')).toBe(false)
    expect(uiState.isCardReadOnly('card-2')).toBe(true)

    uiState.setCardEditMode('card-3', true)
    uiState.toggleCardEditMode('card-2')
    expect(uiState.isCardEditable('card-3')).toBe(false)
    expect(uiState.isCardEditable('card-2')).toBe(false)
  })

  it('resets and prunes card edit states to the visible export cards', () => {
    const uiState = useTimecardExportUiState(ref(true))

    uiState.setCardEditMode('card-1', true)
    uiState.setCardEditMode('card-2', true)

    uiState.pruneCardEditStates(new Set(['card-2']))
    expect(uiState.isCardEditable('card-1')).toBe(false)
    expect(uiState.isCardEditable('card-2')).toBe(true)

    uiState.resetCardEditStates()
    expect(uiState.isCardEditable('card-2')).toBe(false)
  })
})

describe('useTimecardExportCreateTray', () => {
  it('owns create-tray visibility, target fields, employee search, and custom-card form resets', () => {
    const createTray = useTimecardExportCreateTray()

    expect(createTray.showCreateTray.value).toBe(false)
    expect(createTray.createCardJobId.value).toBe('')
    expect(createTray.createCardForemanId.value).toBe('')
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
    createTray.createCardJobId.value = 'job-shop'
    createTray.createCardForemanId.value = 'foreman-cj'
    createTray.employeeSearchTerm.value = 'blanchard'
    createTray.customCardForm.firstName = 'CJ'
    createTray.customCardForm.lastName = 'Blanchard'
    createTray.customCardForm.employeeNumber = '5133'
    createTray.customCardForm.occupation = 'Shop Foreman'
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
    expect(createTray.createCardJobId.value).toBe('job-shop')
    expect(createTray.createCardForemanId.value).toBe('foreman-cj')
    expect(createTray.employeeSearchTerm.value).toBe('blanchard')

    createTray.closeCreateTray()
    expect(createTray.showCreateTray.value).toBe(false)
  })
})

describe('useTimecardExportConfirmDialog', () => {
  it('adapts remove-card confirmations to Timecard Export copy', () => {
    const dialog = useTimecardExportConfirmDialog(ref(false))

    dialog.timecardExportConfirmAction.value = {
      cardId: 'card-1',
      cardLabel: 'Blanchard, CJ',
      kind: 'remove-card',
      weekEndDate: '6/20/2026',
      weekId: 'week-1',
    }

    expect(dialog.timecardExportConfirmTitle.value).toBe('Delete saved timecard?')
    expect(dialog.timecardExportConfirmMessage.value).toBe(
      'Remove Blanchard, CJ from the saved week ending 6/20/2026? This cannot be undone.',
    )
    expect(dialog.timecardExportConfirmLabel.value).toBe('Delete Card')

    dialog.handleTimecardExportConfirmOpenUpdate(false)
    expect(dialog.timecardExportConfirmAction.value).toBeNull()
  })

  it('adapts delete-week confirmations and does not close while an action is busy', () => {
    const isBusy = ref(true)
    const dialog = useTimecardExportConfirmDialog(isBusy)

    dialog.timecardExportConfirmAction.value = {
      kind: 'delete-week',
      weekEndDate: '6/20/2026',
      weekId: 'week-1',
      weekLabel: 'Shop / CJ Blanchard',
    }

    expect(dialog.timecardExportConfirmTitle.value).toBe('Delete draft week?')
    expect(dialog.timecardExportConfirmMessage.value).toBe(
      'Delete the draft week ending 6/20/2026 for Shop / CJ Blanchard? This cannot be undone.',
    )
    expect(dialog.timecardExportConfirmLabel.value).toBe('Delete Draft')

    dialog.handleTimecardExportConfirmOpenUpdate(false)
    expect(dialog.timecardExportConfirmAction.value).not.toBeNull()

    isBusy.value = false
    dialog.handleTimecardExportConfirmOpenUpdate(false)
    expect(dialog.timecardExportConfirmAction.value).toBeNull()
  })

  it('adapts submit and reopen confirmations to Timecard Export copy', () => {
    const dialog = useTimecardExportConfirmDialog(ref(false))

    dialog.timecardExportConfirmAction.value = {
      kind: 'submit-week',
      weekEndDate: '6/20/2026',
      weekId: 'week-1',
      weekLabel: 'Shop / CJ Blanchard',
    }

    expect(dialog.timecardExportConfirmTitle.value).toBe('Submit draft week?')
    expect(dialog.timecardExportConfirmMessage.value).toBe(
      'Submit the week ending 6/20/2026 for Shop / CJ Blanchard? The timecards will be marked submitted.',
    )
    expect(dialog.timecardExportConfirmLabel.value).toBe('Submit Week')

    dialog.timecardExportConfirmAction.value = {
      kind: 'reopen-week',
      weekEndDate: '6/20/2026',
      weekId: 'week-1',
      weekLabel: 'Shop / CJ Blanchard',
    }

    expect(dialog.timecardExportConfirmTitle.value).toBe('Re-open submitted week for corrections?')
    expect(dialog.timecardExportConfirmMessage.value).toBe(
      'Re-open the submitted week ending 6/20/2026 for Shop / CJ Blanchard so it can be corrected and resubmitted?',
    )
    expect(dialog.timecardExportConfirmLabel.value).toBe('Re-open for Corrections')
  })
})
