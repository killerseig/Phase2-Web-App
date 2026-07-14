import { ref } from 'vue'
import { normalizeError } from '@/utils/normalizeError'

export function usePageMessages() {
  const pageError = ref('')
  const pageInfo = ref('')

  function setPageError(error: unknown, fallback: string) {
    pageError.value = normalizeError(error, fallback)
    pageInfo.value = ''
  }

  function setPageErrorMessage(message: string) {
    pageError.value = message
    if (message) pageInfo.value = ''
  }

  function setPageInfo(message: string) {
    pageInfo.value = message
    if (message) pageError.value = ''
  }

  function resetMessages() {
    pageError.value = ''
    pageInfo.value = ''
  }

  return {
    pageError,
    pageInfo,
    resetMessages,
    setPageError,
    setPageErrorMessage,
    setPageInfo,
  }
}
