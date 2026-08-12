import { describe, expect, it } from 'vitest'

import { useRecipientEditor } from '@/composables/useRecipientEditor'

describe('useRecipientEditor', () => {
  it('owns recipient input state and classifies add attempts', () => {
    const editor = useRecipientEditor(' Field@Example.com ')

    expect(editor.recipientInput.value).toBe(' Field@Example.com ')
    expect(editor.getRecipientInputAddResult([])).toEqual({
      status: 'ready',
      email: 'field@example.com',
    })

    editor.recipientInput.value = 'ADMIN@example.com'
    expect(editor.getRecipientInputAddResult(['admin@example.com'])).toEqual({
      status: 'duplicate',
      email: 'admin@example.com',
    })

    editor.clearRecipientInput()
    expect(editor.recipientInput.value).toBe('')
    expect(editor.getRecipientInputAddResult([])).toEqual({
      status: 'empty',
      email: '',
    })
  })

  it('supports value-based classification for keyed recipient editors', () => {
    const editor = useRecipientEditor()

    expect(editor.getRecipientValueAddResult('bad email', [])).toEqual({
      status: 'invalid',
      email: 'bad email',
    })
    expect(editor.getRecipientValueAddResult('office@example.com', [], ['OFFICE@example.com'])).toEqual({
      status: 'duplicate',
      email: 'office@example.com',
    })
  })

  it('adds and removes recipients through the shared normalization rules', () => {
    const editor = useRecipientEditor()

    const nextRecipients = editor.appendRecipient(['office@example.com'], ' Field@Example.com ')
    expect(nextRecipients).toEqual(['office@example.com', 'field@example.com'])
    expect(editor.removeRecipient(nextRecipients, 'OFFICE@example.com')).toEqual(['field@example.com'])
  })
})
