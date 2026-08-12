import { reactive } from 'vue'
import {
  createEmptyCustomItemFormState,
  type CustomItemFormState,
} from '@/features/shopOrders/viewHelpers'

export function useShopOrderCustomItemForm() {
  const customItemForm = reactive<CustomItemFormState>(createEmptyCustomItemFormState())

  function resetCustomItemForm() {
    Object.assign(customItemForm, createEmptyCustomItemFormState())
  }

  return {
    customItemForm,
    resetCustomItemForm,
  }
}
