import { describe, expect, it } from 'vitest'
import { useTimecardCardSelection, type TimecardSelectableCard } from '@/features/timecards/useTimecardCardSelection'

interface TestCard extends TimecardSelectableCard {
  label: string
}

describe('useTimecardCardSelection', () => {
  it('selects the first card and compacts the rest when syncing new cards', () => {
    const cards: TestCard[] = [
      { id: 'card-a', label: 'A' },
      { id: 'card-b', label: 'B' },
      { id: 'card-c', label: 'C' },
    ]
    const selection = useTimecardCardSelection<TestCard>()

    selection.syncCardSelectionState(cards)

    expect(selection.selectedCardId.value).toBe('card-a')
    expect(selection.isCardCompact('card-a')).toBe(false)
    expect(selection.isCardCompact('card-b')).toBe(true)
    expect(selection.isCardCompact('card-c')).toBe(true)
  })

  it('uses ordered cards for fallback selection without changing the valid card set', () => {
    const cards: TestCard[] = [
      { id: 'card-a', label: 'A' },
      { id: 'card-b', label: 'B' },
    ]
    const orderedCards = [cards[1]!, cards[0]!]
    const selection = useTimecardCardSelection<TestCard>()

    selection.syncCardSelectionState(cards, orderedCards)

    expect(selection.selectedCardId.value).toBe('card-b')
    expect(selection.isCardCompact('card-b')).toBe(false)
    expect(selection.isCardCompact('card-a')).toBe(true)
  })

  it('keeps existing compact state while pruning removed cards', () => {
    const selection = useTimecardCardSelection<TestCard>()

    selection.syncCardSelectionState([
      { id: 'card-a', label: 'A' },
      { id: 'card-b', label: 'B' },
    ])
    selection.toggleCardCompact('card-a')
    selection.toggleCardCompact('card-b')

    selection.syncCardSelectionState([{ id: 'card-b', label: 'B' }])

    expect(selection.selectedCardId.value).toBe('card-b')
    expect(selection.compactCardStates['card-a']).toBeUndefined()
    expect(selection.isCardCompact('card-b')).toBe(false)
  })

  it('expands and selects newly created cards', () => {
    const selection = useTimecardCardSelection<TestCard>()

    selection.expandAndSelectCard('card-new')

    expect(selection.selectedCardId.value).toBe('card-new')
    expect(selection.isCardCompact('card-new')).toBe(false)
  })

  it('selects the first visible card or clears selection when filters hide every card', () => {
    const selection = useTimecardCardSelection<TestCard>()
    selection.selectCard('card-hidden')

    selection.syncSelectedCardFromVisibleCards([
      { id: 'card-visible', label: 'Visible' },
    ])
    expect(selection.selectedCardId.value).toBe('card-visible')

    selection.syncSelectedCardFromVisibleCards([])
    expect(selection.selectedCardId.value).toBeNull()
  })
})
