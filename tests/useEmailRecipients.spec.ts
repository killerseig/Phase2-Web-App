import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useEmailRecipients } from '@/composables/useEmailRecipients'

describe('useEmailRecipients', () => {
  it('adds a recipient and persists the updated list', async () => {
    const recipients = ref(['alpha@example.com'])
    const saveRecipients = vi.fn().mockResolvedValue(undefined)
    const show = vi.fn()

    const { addRecipient } = useEmailRecipients({
      toast: { show },
    })

    await addRecipient('beta@example.com', {
      getRecipients: () => recipients.value,
      setRecipients: (emails) => {
        recipients.value = emails
      },
      saveRecipients,
    })

    expect(saveRecipients).toHaveBeenCalledWith(['alpha@example.com', 'beta@example.com'])
    expect(recipients.value).toEqual(['alpha@example.com', 'beta@example.com'])
    expect(show).toHaveBeenCalledWith('Email recipients updated', 'success')
  })

  it('rejects duplicate recipients before saving', async () => {
    const recipients = ref(['alpha@example.com'])
    const saveRecipients = vi.fn().mockResolvedValue(undefined)
    const show = vi.fn()

    const { addRecipient } = useEmailRecipients({
      toast: { show },
    })

    const result = await addRecipient('alpha@example.com', {
      getRecipients: () => recipients.value,
      setRecipients: (emails) => {
        recipients.value = emails
      },
      saveRecipients,
    })

    expect(result).toBe(false)
    expect(saveRecipients).not.toHaveBeenCalled()
    expect(show).toHaveBeenCalledWith('Email already in the list', 'warning')
  })

  it('surfaces save failures through the error callback', async () => {
    const recipients = ref(['alpha@example.com'])
    const show = vi.fn()
    const onError = vi.fn()
    const saveRecipients = vi.fn().mockRejectedValue(new Error('Network unavailable'))

    const { removeRecipient } = useEmailRecipients({
      toast: { show },
      onError,
    })

    const result = await removeRecipient('alpha@example.com', {
      getRecipients: () => recipients.value,
      setRecipients: (emails) => {
        recipients.value = emails
      },
      saveRecipients,
      messages: {
        removeError: 'Failed to remove email recipient',
      },
    })

    expect(result).toBe(false)
    expect(recipients.value).toEqual(['alpha@example.com'])
    expect(onError).toHaveBeenCalledWith('Network unavailable')
    expect(show).toHaveBeenCalledWith('Failed to remove email recipient', 'error')
  })
})
