import { computed, ref } from 'vue'
import { normalizeError } from '@/services/serviceUtils'
import { isValidEmail } from '@/utils/emailValidation'
import { useToast, type ToastNotifier, type ToastType } from './useToast'

type EmailRecipientMessages = {
  invalid?: string
  duplicate?: string
  saveSuccess?: string
  saveError?: string
  addSuccess?: string
  addError?: string
  removeSuccess?: string
  removeError?: string
}

type EmailRecipientListConfig = {
  getRecipients: () => string[]
  setRecipients: (emails: string[]) => void
  saveRecipients: (emails: string[]) => Promise<void>
  messages?: EmailRecipientMessages
}

type UseEmailRecipientsOptions = {
  toast?: ToastNotifier | null
  onError?: (message: string) => void
}

const defaultMessages: Required<Pick<EmailRecipientMessages, 'invalid' | 'duplicate' | 'saveSuccess' | 'saveError'>> = {
  invalid: 'Please enter a valid email address',
  duplicate: 'Email already in the list',
  saveSuccess: 'Email recipients updated',
  saveError: 'Failed to save recipients',
}

const normalizeRecipients = (emails: string[]): string[] => emails.map((email) => email.trim()).filter(Boolean)

export function useEmailRecipients(options: UseEmailRecipientsOptions = {}) {
  const activeSaves = ref(0)
  const saving = computed(() => activeSaves.value > 0)
  const toast = options.toast ?? useToast()

  const showToast = (message: string, type: ToastType) => {
    toast.show(message, type)
  }

  const resolveMessage = (
    messages: EmailRecipientMessages | undefined,
    actionKey: 'add' | 'remove',
    fallbackKey: 'saveSuccess' | 'saveError'
  ) => {
    if (actionKey === 'add' && fallbackKey === 'saveSuccess') return messages?.addSuccess ?? messages?.saveSuccess ?? defaultMessages.saveSuccess
    if (actionKey === 'add' && fallbackKey === 'saveError') return messages?.addError ?? messages?.saveError ?? defaultMessages.saveError
    if (actionKey === 'remove' && fallbackKey === 'saveSuccess') return messages?.removeSuccess ?? messages?.saveSuccess ?? defaultMessages.saveSuccess
    return messages?.removeError ?? messages?.saveError ?? defaultMessages.saveError
  }

  const persistRecipients = async (
    nextRecipients: string[],
    config: EmailRecipientListConfig,
    action: 'add' | 'remove'
  ) => {
    activeSaves.value += 1
    try {
      await config.saveRecipients(nextRecipients)
      config.setRecipients(nextRecipients)
      showToast(resolveMessage(config.messages, action, 'saveSuccess'), 'success')
      return true
    } catch (error) {
      const fallbackMessage = resolveMessage(config.messages, action, 'saveError')
      const normalizedMessage = normalizeError(error, fallbackMessage)
      options.onError?.(normalizedMessage)
      showToast(fallbackMessage, 'error')
      return false
    } finally {
      activeSaves.value -= 1
    }
  }

  const addRecipient = async (emailValue: string, config: EmailRecipientListConfig) => {
    const email = emailValue.trim()
    if (!email || !isValidEmail(email)) {
      showToast(config.messages?.invalid ?? defaultMessages.invalid, 'error')
      return false
    }

    const currentRecipients = normalizeRecipients(config.getRecipients())
    if (currentRecipients.includes(email)) {
      showToast(config.messages?.duplicate ?? defaultMessages.duplicate, 'warning')
      return false
    }

    return persistRecipients([...currentRecipients, email], config, 'add')
  }

  const removeRecipient = async (emailValue: string, config: EmailRecipientListConfig) => {
    const email = emailValue.trim()
    const currentRecipients = normalizeRecipients(config.getRecipients())
    const nextRecipients = currentRecipients.filter((recipient) => recipient !== email)
    if (nextRecipients.length === currentRecipients.length) return true
    return persistRecipients(nextRecipients, config, 'remove')
  }

  return {
    saving,
    addRecipient,
    removeRecipient,
  }
}
