import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TimecardCanvasPanel from '@/components/timecards/TimecardCanvasPanel.vue'

interface TestCard {
  id: string
  name: string
}

const cards: TestCard[] = [
  { id: 'card-1', name: 'Chris Larsen' },
  { id: 'card-2', name: 'CJ Blanchard' },
]

function mountCanvas(overrides = {}) {
  return mount(TimecardCanvasPanel<TestCard>, {
    props: {
      cards,
      loading: false,
      emptyMessage: 'No cards found.',
      selectedCardId: 'card-2',
      isCardCompact: (cardId: string) => cardId === 'card-1',
      getCardShellStyle: (cardId: string) => ({ minHeight: cardId === 'card-1' ? '100px' : '200px' }),
      getCardScaleStyle: (cardId: string) => ({ transform: cardId === 'card-1' ? 'scale(0.8)' : 'scale(1)' }),
      getCardDomId: (card: TestCard) => `dom-${card.id}`,
      getCardTestId: (card: TestCard) => `card-${card.id}`,
      hasCardFooter: (card: TestCard) => card.id === 'card-2',
      ...overrides,
    },
    slots: {
      header: '<h2>Time Cards</h2>',
      itemActions: '<template #itemActions="{ card }"><button class="action-button">Action {{ card.name }}</button></template>',
      card: '<template #card="{ card }"><div class="card-body">{{ card.name }}</div></template>',
      footer: '<template #footer="{ card }"><button class="footer-button">Delete {{ card.name }}</button></template>',
    },
  })
}

describe('TimecardCanvasPanel', () => {
  it('renders loading and empty states before card content', () => {
    expect(
      mountCanvas({
        loading: true,
        loadingMessage: 'Loading cards...',
      }).text(),
    ).toContain('Loading cards...')

    expect(
      mountCanvas({
        cards: [],
      }).text(),
    ).toContain('No cards found.')
  })

  it('renders card chrome, slot content, styles, and conditional footer content', () => {
    const wrapper = mountCanvas()
    const firstCard = wrapper.get('[data-testid="card-card-1"]')
    const secondCard = wrapper.get('[data-testid="card-card-2"]')

    expect(wrapper.text()).toContain('Time Cards')
    expect(firstCard.attributes('id')).toBe('dom-card-1')
    expect(firstCard.classes()).toContain('timecards-canvas__item--compact')
    expect(secondCard.classes()).toContain('timecards-canvas__item--active')
    expect(wrapper.text()).toContain('Chris Larsen')
    expect(wrapper.text()).toContain('Action CJ Blanchard')
    expect(wrapper.text()).not.toContain('Delete Chris Larsen')
    expect(wrapper.text()).toContain('Delete CJ Blanchard')
    expect(firstCard.get('.timecards-canvas__item-card-shell').attributes('style')).toContain('min-height: 100px')
    expect(firstCard.get('.timecards-canvas__item-card-scale').attributes('style')).toContain('scale(0.8)')
  })

  it('emits selection, compact toggle, and measurement element events with the card id', async () => {
    const wrapper = mountCanvas()
    const firstCard = wrapper.get('[data-testid="card-card-1"]')

    await firstCard.trigger('mousedown')
    await firstCard.trigger('focusin')
    await firstCard.get('.timecards-canvas__item-header-button--collapse').trigger('click')

    expect(wrapper.emitted('selectCard')).toEqual([['card-1'], ['card-1']])
    expect(wrapper.emitted('toggleCardCompact')).toEqual([['card-1']])
    expect(wrapper.emitted('setShellElement')?.[0]?.[0]).toBe('card-1')
    expect(wrapper.emitted('setShellElement')?.[0]?.[1]).toBeInstanceOf(Element)
    expect(wrapper.emitted('setContentElement')?.[0]?.[0]).toBe('card-1')
    expect(wrapper.emitted('setContentElement')?.[0]?.[1]).toBeInstanceOf(Element)
  })
})
