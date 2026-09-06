<script setup lang="ts">
import type { StyleValue } from 'vue'
import TimecardCanvasPanel from '@/components/timecards/TimecardCanvasPanel.vue'
import TimecardSourceBadge from '@/components/timecards/TimecardSourceBadge.vue'
import TimecardWorkbookCard from '@/components/timecards/TimecardWorkbookCard.vue'
import type { TimecardExportArchiveCardRecord } from '@/features/timecards/exportViewHelpers'

defineProps<{
  cards: TimecardExportArchiveCardRecord[]
  cardsLoading: boolean
  weeksLoading: boolean
  heading: string
  packageCountLabel: string
  jobsLabel: string
  foremenLabel: string
  emptyMessage: string
  selectedCardId: string | null
  canEditWeek: boolean
  actionLoading: boolean
  showEmployeeWage: boolean
  showCostValues: boolean
  isCardCompact: (cardId: string) => boolean
  isCardEditable: (cardId: string) => boolean
  isCardReadOnly: (cardId: string) => boolean
  getCardShellStyle: (cardId: string) => StyleValue
  getCardScaleStyle: (cardId: string) => StyleValue
  setCardShellElement: (cardId: string, element: Element | null) => void
  setCardContentElement: (cardId: string, element: Element | null) => void
}>()

const emit = defineEmits<{
  selectCard: [cardId: string]
  toggleCardCompact: [cardId: string]
  toggleCardEditMode: [cardId: string]
  workbookChanged: [card: TimecardExportArchiveCardRecord]
  removeCard: [card: TimecardExportArchiveCardRecord]
}>()
</script>

<template>
  <TimecardCanvasPanel
    :cards="cards"
    :loading="cardsLoading || weeksLoading"
    :empty-message="emptyMessage"
    :selected-card-id="selectedCardId"
    :is-card-compact="isCardCompact"
    :get-card-shell-style="getCardShellStyle"
    :get-card-scale-style="getCardScaleStyle"
    :get-card-dom-id="(card) => `timecard-export-card-${card.id}`"
    :has-card-footer="(card) => canEditWeek && isCardEditable(card.id) && !isCardCompact(card.id)"
    @select-card="emit('selectCard', $event)"
    @toggle-card-compact="emit('toggleCardCompact', $event)"
    @set-shell-element="setCardShellElement"
    @set-content-element="setCardContentElement"
  >
    <template #header>
        <div>
          <span class="timecards-canvas-panel__eyebrow">Time Cards</span>
          <h2>{{ heading }}</h2>
        </div>

        <div class="timecards-canvas-panel__meta">
          <span>{{ packageCountLabel }}</span>
          <span>{{ jobsLabel }}</span>
          <span>{{ foremenLabel }}</span>
        </div>
    </template>

    <template #itemActions="{ card }">
      <TimecardSourceBadge
        :source-type="card.sourceType"
        :test-id="`timecard-card-source-${card.id}`"
      />
      <button
        v-if="canEditWeek"
        class="timecards-canvas__item-header-button timecards-canvas__item-header-button--edit"
        :class="{ 'timecards-canvas__item-header-button--active': isCardEditable(card.id) }"
        type="button"
        @click.stop="emit('toggleCardEditMode', card.id)"
      >
        {{ isCardEditable(card.id) ? 'Lock Card' : 'Edit Card' }}
      </button>
    </template>

    <template #card="{ card }">
      <TimecardWorkbookCard
        :card="card"
        :compact="isCardCompact(card.id)"
        :week-end-date="card.archiveWeekEndDate"
        :burden="card.archiveBurden"
        :read-only="isCardReadOnly(card.id)"
        :show-employee-wage="showEmployeeWage"
        :show-cost-values="showCostValues"
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
