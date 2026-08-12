import { ref } from 'vue'
import {
  appendRecipientEmail,
  getRecipientAddResult,
  removeRecipientEmail,
  type RecipientAddResult,
} from '@/utils/recipientEmails'

export function useRecipientEditor(initialInput = '') {
  const recipientInput = ref(initialInput)

  function clearRecipientInput() {
    recipientInput.value = ''
  }

  function getRecipientInputAddResult(
    existingRecipients: readonly string[],
    reservedRecipients: readonly string[] = [],
  ): RecipientAddResult {
    return getRecipientAddResult(recipientInput.value, existingRecipients, reservedRecipients)
  }

  function getRecipientValueAddResult(
    value: string,
    existingRecipients: readonly string[],
    reservedRecipients: readonly string[] = [],
  ): RecipientAddResult {
    return getRecipientAddResult(value, existingRecipients, reservedRecipients)
  }

  function appendRecipient(recipients: readonly string[], email: string) {
    return appendRecipientEmail(recipients, email)
  }

  function removeRecipient(recipients: readonly string[], email: string) {
    return removeRecipientEmail(recipients, email)
  }

  return {
    appendRecipient,
    clearRecipientInput,
    getRecipientInputAddResult,
    getRecipientValueAddResult,
    recipientInput,
    removeRecipient,
  }
}
