import { describe, expect, it } from 'vitest'
import { usePageMessages } from '@/composables/usePageMessages'

describe('usePageMessages', () => {
  it('keeps error and info messages mutually exclusive when setting non-empty messages', () => {
    const messages = usePageMessages()

    messages.setPageInfo('Saved.')
    expect(messages.pageInfo.value).toBe('Saved.')
    expect(messages.pageError.value).toBe('')

    messages.setPageErrorMessage('Failed.')
    expect(messages.pageError.value).toBe('Failed.')
    expect(messages.pageInfo.value).toBe('')
  })

  it('clears one message channel without disturbing the other channel', () => {
    const messages = usePageMessages()

    messages.setPageInfo('Saved.')
    messages.clearPageError()
    expect(messages.pageInfo.value).toBe('Saved.')

    messages.setPageErrorMessage('Failed.')
    messages.clearPageInfo()
    expect(messages.pageError.value).toBe('Failed.')
  })

  it('resets both message channels', () => {
    const messages = usePageMessages()

    messages.setPageErrorMessage('Failed.')
    messages.resetMessages()

    expect(messages.pageError.value).toBe('')
    expect(messages.pageInfo.value).toBe('')
  })
})
