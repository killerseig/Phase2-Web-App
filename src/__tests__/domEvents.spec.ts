import { describe, expect, it } from 'vitest'

import { readInputValue } from '@/utils/domEvents'

function eventFor(target: EventTarget) {
  return Object.defineProperty(new Event('input', { bubbles: true }), 'target', { value: target })
}

describe('domEvents', () => {
  it('reads values from text inputs', () => {
    const input = document.createElement('input')
    input.value = 'Shop'

    expect(readInputValue(eventFor(input))).toBe('Shop')
  })

  it('reads values from textareas', () => {
    const textarea = document.createElement('textarea')
    textarea.value = 'Daily log note with spaces'

    expect(readInputValue(eventFor(textarea))).toBe('Daily log note with spaces')
  })

  it('returns an empty string for non-text-entry events', () => {
    const button = document.createElement('button')

    expect(readInputValue(eventFor(button))).toBe('')
  })
})
