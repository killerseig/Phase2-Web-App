import { ref } from 'vue'
import {
  createEmptyDailyLogPayload,
  type DailyLogTextFieldKey,
} from './schema'
import { getE2ENowValue } from '@/testing/e2eRuntime'

export function getDailyLogTodayDateString() {
  const now = getE2ENowValue() ?? new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function useDailyLogFormState() {
  const selectedDate = ref(getDailyLogTodayDateString())
  const selectedLogId = ref<string | null>(null)
  const form = ref(createEmptyDailyLogPayload())

  function updateDailyLogTextField(fieldKey: DailyLogTextFieldKey, value: string) {
    form.value[fieldKey] = value
  }

  return {
    form,
    getTodayDateString: getDailyLogTodayDateString,
    selectedDate,
    selectedLogId,
    updateDailyLogTextField,
  }
}
