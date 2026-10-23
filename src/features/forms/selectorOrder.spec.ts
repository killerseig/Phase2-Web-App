import { expect, it } from 'vitest'
import { alphabetizeFormChoices } from './selectorOrder'
it('alphabetizes displayed names without changing equal-name order or mutating records', () => {
  const choices = [{ label: 'zebra', key: 'last' }, { label: 'Alpha', key: 'first' }, { label: 'alpha', key: 'second' }, { label: 'beta', key: 'middle' }]
  const before = structuredClone(choices)
  expect(alphabetizeFormChoices(choices).map(item => item.key)).toEqual(['first', 'second', 'middle', 'last'])
  expect(choices).toEqual(before)
})
