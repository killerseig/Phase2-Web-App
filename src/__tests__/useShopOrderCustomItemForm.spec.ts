import { describe, expect, it } from 'vitest'

import { useShopOrderCustomItemForm } from '@/features/shopOrders/useShopOrderCustomItemForm'
import { createEmptyCustomItemFormState } from '@/features/shopOrders/viewHelpers'

describe('useShopOrderCustomItemForm', () => {
  it('creates the default custom-item form state', () => {
    const { customItemForm } = useShopOrderCustomItemForm()

    expect(customItemForm).toEqual(createEmptyCustomItemFormState())
  })

  it('resets the same reactive form object back to defaults', () => {
    const { customItemForm, resetCustomItemForm } = useShopOrderCustomItemForm()
    const originalForm = customItemForm

    customItemForm.description = 'Bottled water'
    customItemForm.quantity = '5'
    customItemForm.note = '100 bottles total'

    resetCustomItemForm()

    expect(customItemForm).toBe(originalForm)
    expect(customItemForm).toEqual(createEmptyCustomItemFormState())
  })
})
