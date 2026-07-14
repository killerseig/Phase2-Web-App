<script setup lang="ts">
import type { StyleValue } from 'vue'
import TimecardCanvasPanel from '@/components/timecards/TimecardCanvasPanel.vue'
import TimecardWorkbookCard from '@/components/timecards/TimecardWorkbookCard.vue'
import type { TimecardCardRecord } from '@/types/domain'

defineProps<{
  cards: TimecardCardRecord[]
  cardsLoading: boolean
  ensuringWeek: boolean
  selectedWeekEndDate: string
  selectedCardId: string | null
  emptyMessage: string
  burden: number
  canEditWeek: boolean
  actionLoading: boolean
  isAdmin: boolean
  isCardCompact: (cardId: string) => boolean
  isCardReadOnly: (cardId: string) => boolean
  getCardShellStyle: (cardId: string) => StyleValue | undefined
  getCardScaleStyle: (cardId: string) => StyleValue
}>()

const emit = defineEmits<{
  selectCard: [cardId: string]
  toggleCardCompact: [cardId: string]
  setShellElement: [cardId: string, element: Element | null]
  setContentElement: [cardId: string, element: Element | null]
  workbookChanged: [card: TimecardCardRecord]
  removeCard: [card: TimecardCardRecord]
}>()

function formatPanelDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return `${parsed.getMonth() + 1}/${parsed.getDate()}/${parsed.getFullYear()}`
}
</script>

<template>
  <TimecardCanvasPanel
    :cards="cards"
    :loading="cardsLoading || ensuringWeek"
    :empty-message="emptyMessage"
    :selected-card-id="selectedCardId"
    :is-card-compact="isCardCompact"
    :get-card-shell-style="getCardShellStyle"
    :get-card-scale-style="getCardScaleStyle"
    :get-card-dom-id="(card) => `timecard-card-${card.id}`"
    :get-card-test-id="(card) => `timecards-card-${card.id}`"
    :has-card-footer="(card) => canEditWeek && !isCardCompact(card.id)"
    @select-card="emit('selectCard', $event)"
    @toggle-card-compact="emit('toggleCardCompact', $event)"
    @set-shell-element="(cardId, element) => emit('setShellElement', cardId, element)"
    @set-content-element="(cardId, element) => emit('setContentElement', cardId, element)"
  >
    <template #header>
        <span class="timecards-canvas-panel__eyebrow">Time Cards</span>
        <div class="timecards-canvas-panel__meta">
          <span>{{ formatPanelDate(selectedWeekEndDate) }}</span>
          <span>{{ cards.length }} Visible</span>
        </div>
    </template>

    <template #card="{ card }">
      <TimecardWorkbookCard
        :card="card"
        :compact="isCardCompact(card.id)"
        :week-end-date="selectedWeekEndDate"
        :burden="burden"
        :read-only="isCardReadOnly(card.id)"
        :employee-header-locked="card.sourceType !== 'custom' && (!isAdmin || isCardReadOnly(card.id))"
        :show-employee-wage="true"
        @changed="emit('workbookChanged', card)"
      />
    </template>

    <template #footer="{ card }">
      <button
        class="timecards-canvas__item-footer-button"
        type="button"
        :disabled="actionLoading"
        @click.stop="emit('removeCard', card)"
      >
        Delete Card
      </button>
    </template>
  </TimecardCanvasPanel>
</template>
