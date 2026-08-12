import { describe, expect, it } from 'vitest'

import {
  getNextShopOrderSelectionId,
  shouldShowShopOrderSuccessToast,
} from '@/features/shopOrders/viewHelpers'

describe('shop order view helpers', () => {
  it('keeps a current order selection but only falls back to a draft order', () => {
    expect(getNextShopOrderSelectionId([
      { id: 'submitted-order', status: 'submitted' },
      { id: 'draft-order', status: 'draft' },
    ], 'submitted-order')).toBe('submitted-order')

    expect(getNextShopOrderSelectionId([
      { id: 'submitted-order', status: 'submitted' },
      { id: 'draft-order', status: 'draft' },
    ], 'missing-order')).toBe('draft-order')

    expect(getNextShopOrderSelectionId([
      { id: 'submitted-order', status: 'submitted' },
    ], null)).toBeNull()
  })

  it('suppresses frequent background save and item-added success messages', () => {
    expect(shouldShowShopOrderSuccessToast('New order started.')).toBe(false)
    expect(shouldShowShopOrderSuccessToast('Order details saved.')).toBe(false)
    expect(shouldShowShopOrderSuccessToast('Order quantity updated.')).toBe(false)
    expect(shouldShowShopOrderSuccessToast('Order note updated.')).toBe(false)
    expect(shouldShowShopOrderSuccessToast('Custom item added to the current order.')).toBe(false)
    expect(shouldShowShopOrderSuccessToast('AHA Book added to the current order.')).toBe(false)
  })

  it('allows less-noisy user action messages to show as toasts', () => {
    expect(shouldShowShopOrderSuccessToast('Order submitted.')).toBe(true)
    expect(shouldShowShopOrderSuccessToast('Draft order deleted.')).toBe(true)
  })
})
