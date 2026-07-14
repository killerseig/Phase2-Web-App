import { reactive, ref } from 'vue'
import {
  createEmptyTimecardExportCustomCardForm,
  resetTimecardExportCustomCardForm,
  type TimecardExportCustomCardFormState,
} from '@/features/timecards/exportViewHelpers'

export function useTimecardExportCreateTray() {
  const showCreateTray = ref(false)
  const employeeSearchTerm = ref('')
  const createCardJobId = ref('')
  const createCardForemanId = ref('')
  const customCardForm = reactive<TimecardExportCustomCardFormState>(createEmptyTimecardExportCustomCardForm())

  function resetCustomCardForm() {
    resetTimecardExportCustomCardForm(customCardForm)
  }

  function closeCreateTray() {
    showCreateTray.value = false
  }

  function toggleCreateTray() {
    showCreateTray.value = !showCreateTray.value
  }

  return {
    closeCreateTray,
    createCardForemanId,
    createCardJobId,
    customCardForm,
    employeeSearchTerm,
    resetCustomCardForm,
    showCreateTray,
    toggleCreateTray,
  }
}
