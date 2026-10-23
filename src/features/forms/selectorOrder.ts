const names = new Intl.Collator('en', { sensitivity: 'base' })
/** Keep equal displayed names in their original order without mutating source records. */
export function alphabetizeFormChoices<T extends { label: string }>(choices: readonly T[]): T[] {
  return choices.map((choice, index) => ({ choice, index }))
    .sort((a, b) => names.compare(a.choice.label, b.choice.label) || a.index - b.index)
    .map(item => item.choice)
}
