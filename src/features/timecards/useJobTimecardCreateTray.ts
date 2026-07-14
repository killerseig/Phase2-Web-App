import { reactive, ref } from 'vue'
import {
  createEmptyJobTimecardCustomCardForm,
  resetJobTimecardCustomCardForm,
  type JobTimecardCustomCardFormState,
} from '@/features/timecards/jobViewHelpers'

export function useJobTimecardCreateTray() {
  const employeeSearchTerm = ref('')
  const showCreateTray = ref(false)
  const customCardForm = reactive<JobTimecardCustomCardFormState>(createEmptyJobTimecardCustomCardForm())

  function resetCustomCardForm() {
    resetJobTimecardCustomCardForm(customCardForm)
  }

  function closeCreateTray() {
    showCreateTray.value = false
  }

  function toggleCreateTray() {
    showCreateTray.value = !showCreateTray.value
  }

  return {
    closeCreateTray,
    customCardForm,
    employeeSearchTerm,
    resetCustomCardForm,
    showCreateTray,
    toggleCreateTray,
  }
}
