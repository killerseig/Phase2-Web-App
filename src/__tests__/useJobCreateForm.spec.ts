import { describe, expect, it, vi } from 'vitest'

import { useJobCreateForm } from '@/features/jobs/useJobCreateForm'
import { createEmptyNotificationRecipients, createRecipientInputState } from '@/features/jobs/jobViewHelpers'

describe('useJobCreateForm', () => {
  it('starts with the standard create-job defaults', () => {
    const { createForm, createNotificationRecipients, createRecipientInputs } = useJobCreateForm({
      clearCreateMessages: vi.fn(),
    })

    expect(createForm).toEqual({
      assignedForemanIds: [],
      code: '',
      finishDate: '',
      gc: '',
      jobAddress: '',
      name: '',
      productionBurden: '0.33',
      startDate: '',
      type: 'general',
    })
    expect(createNotificationRecipients).toEqual(createEmptyNotificationRecipients())
    expect(createRecipientInputs).toEqual(createRecipientInputState())
  })

  it('updates individual text fields without mutating other create-form state', () => {
    const { createForm, updateCreateFormField } = useJobCreateForm({
      clearCreateMessages: vi.fn(),
    })

    updateCreateFormField('name', 'Phase 2 Office')
    updateCreateFormField('code', '111A')

    expect(createForm.name).toBe('Phase 2 Office')
    expect(createForm.code).toBe('111A')
    expect(createForm.type).toBe('general')
    expect(createForm.productionBurden).toBe('0.33')
  })

  it('resets create fields, notification recipients, recipient inputs, and messages', () => {
    const clearCreateMessages = vi.fn()
    const {
      createForm,
      createNotificationRecipients,
      createRecipientInputs,
      resetCreateForm,
    } = useJobCreateForm({ clearCreateMessages })

    createForm.name = 'Dirty Job'
    createForm.code = '999'
    createForm.type = 'paint'
    createForm.productionBurden = '0.5'
    createForm.assignedForemanIds.push('foreman-1')
    createNotificationRecipients.dailyLogs.push('daily@example.com')
    createNotificationRecipients.timecards.push('time@example.com')
    createNotificationRecipients.shopOrders.push('shop@example.com')
    createRecipientInputs.dailyLogs = 'pending daily'
    createRecipientInputs.timecards = 'pending time'
    createRecipientInputs.shopOrders = 'pending shop'

    resetCreateForm()

    expect(createForm.name).toBe('')
    expect(createForm.code).toBe('')
    expect(createForm.type).toBe('general')
    expect(createForm.productionBurden).toBe('0.33')
    expect(createForm.assignedForemanIds).toEqual([])
    expect(createNotificationRecipients).toEqual(createEmptyNotificationRecipients())
    expect(createRecipientInputs).toEqual(createRecipientInputState())
    expect(clearCreateMessages).toHaveBeenCalledTimes(1)
  })
})
