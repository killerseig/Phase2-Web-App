import { reactive, ref } from 'vue'
import { clearBooleanRecord, pruneRecordToIds } from './stateMapHelpers'

export interface TimecardSelectableCard {
  id: string
}

interface TimecardCardSelectionOptions<TCard extends TimecardSelectableCard> {
  getCards?: () => readonly TCard[]
}

export function useTimecardCardSelection<TCard extends TimecardSelectableCard = TimecardSelectableCard>(
  options: TimecardCardSelectionOptions<TCard> = {},
) {
  const selectedCardId = ref<string | null>(null)
  const compactCardStates = reactive<Record<string, boolean>>({})

  function selectCard(cardId: string) {
    selectedCardId.value = cardId
  }

  function isCardCompact(cardId: string) {
    return compactCardStates[cardId] === true
  }

  function toggleCardCompact(cardId: string) {
    compactCardStates[cardId] = !compactCardStates[cardId]
  }

  function setAllCardsCompact(compact: boolean, targetCards: readonly TCard[] = options.getCards?.() ?? []) {
    targetCards.forEach((card) => {
      compactCardStates[card.id] = compact
    })
  }

  function expandAndSelectCard(cardId: string) {
    compactCardStates[cardId] = false
    selectedCardId.value = cardId
  }

  function resetCardSelectionState() {
    clearBooleanRecord(compactCardStates)
    selectedCardId.value = null
  }

  function syncCardSelectionState(
    cards: readonly TCard[],
    orderedCards: readonly TCard[] = cards,
  ) {
    const validIds = new Set(cards.map((card) => card.id))
    pruneRecordToIds(compactCardStates, validIds)

    const fallbackCard = orderedCards.find((card) => validIds.has(card.id)) ?? cards[0] ?? null
    const nextSelectedCardId = selectedCardId.value && validIds.has(selectedCardId.value)
      ? selectedCardId.value
      : fallbackCard?.id ?? null

    cards.forEach((card) => {
      if (!Object.prototype.hasOwnProperty.call(compactCardStates, card.id)) {
        compactCardStates[card.id] = cards.length > 1 && card.id !== nextSelectedCardId
      }
    })

    selectedCardId.value = nextSelectedCardId
  }

  function syncSelectedCardFromVisibleCards(visibleCards: readonly TCard[]) {
    if (!visibleCards.length) {
      selectedCardId.value = null
      return
    }

    if (!selectedCardId.value || !visibleCards.some((card) => card.id === selectedCardId.value)) {
      selectedCardId.value = visibleCards[0]?.id ?? null
    }
  }

  return {
    compactCardStates,
    expandAndSelectCard,
    isCardCompact,
    resetCardSelectionState,
    selectCard,
    selectedCardId,
    setAllCardsCompact,
    syncCardSelectionState,
    syncSelectedCardFromVisibleCards,
    toggleCardCompact,
  }
}
