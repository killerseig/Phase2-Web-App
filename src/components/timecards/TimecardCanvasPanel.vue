<script setup lang="ts" generic="TCard extends { id: string }">
import type { ComponentPublicInstance, StyleValue } from 'vue'

const props = withDefaults(defineProps<{
  cards: TCard[]
  loading: boolean
  emptyMessage: string
  selectedCardId: string | null
  isCardCompact: (cardId: string) => boolean
  getCardShellStyle: (cardId: string) => StyleValue | undefined
  getCardScaleStyle: (cardId: string) => StyleValue
  getCardDomId?: (card: TCard) => string
  getCardTestId?: (card: TCard) => string
  hasCardFooter?: (card: TCard) => boolean
  loadingMessage?: string
}>(), {
  loadingMessage: 'Loading workbook...',
})

defineSlots<{
  header(): unknown
  itemActions(props: { card: TCard }): unknown
  card(props: { card: TCard }): unknown
  footer(props: { card: TCard }): unknown
}>()

const emit = defineEmits<{
  selectCard: [cardId: string]
  toggleCardCompact: [cardId: string]
  setShellElement: [cardId: string, element: Element | null]
  setContentElement: [cardId: string, element: Element | null]
}>()

function asObservedElement(element: Element | ComponentPublicInstance | null): Element | null {
  return element instanceof Element ? element : null
}

function shouldShowFooter(card: TCard) {
  return props.hasCardFooter?.(card) ?? false
}
</script>

<template>
  <div class="timecards-workspace">
    <section class="timecards-canvas-panel">
      <div class="timecards-canvas-panel__header">
        <slot name="header" />
      </div>

      <div v-if="loading" class="timecards-canvas-empty timecards-canvas-empty--canvas">
        {{ loadingMessage }}
      </div>

      <div v-else-if="!cards.length" class="timecards-canvas-empty timecards-canvas-empty--canvas">
        {{ emptyMessage }}
      </div>

      <div v-else class="timecards-canvas">
        <article
          v-for="card in cards"
          :id="getCardDomId?.(card)"
          :key="card.id"
          :data-testid="getCardTestId?.(card)"
          class="timecards-canvas__item"
          :class="{
            'timecards-canvas__item--active': card.id === selectedCardId,
            'timecards-canvas__item--compact': isCardCompact(card.id),
          }"
          @mousedown.capture="emit('selectCard', card.id)"
          @focusin.capture="emit('selectCard', card.id)"
        >
          <div class="timecards-canvas__item-header">
            <button
              class="timecards-canvas__item-header-button timecards-canvas__item-header-button--collapse"
              type="button"
              @click="emit('toggleCardCompact', card.id)"
            >
              <span class="timecards-canvas__item-header-label">
                {{ isCardCompact(card.id) ? 'Expand Card' : 'Collapse Card' }}
              </span>
            </button>

            <slot name="itemActions" :card="card" />
          </div>

          <div
            class="timecards-canvas__item-card-shell"
            :style="getCardShellStyle(card.id)"
            :ref="(element) => emit('setShellElement', card.id, asObservedElement(element))"
          >
            <div
              class="timecards-canvas__item-card-scale"
              :style="getCardScaleStyle(card.id)"
              :ref="(element) => emit('setContentElement', card.id, asObservedElement(element))"
            >
              <slot name="card" :card="card" />
            </div>
          </div>

          <div v-if="shouldShowFooter(card)" class="timecards-canvas__item-footer">
            <slot name="footer" :card="card" />
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style>
.timecards-workspace {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  align-items: start;
  min-width: 0;
}

.timecards-canvas-panel {
  display: grid;
  gap: 1rem;
  min-width: 0;
  padding: 1rem;
  border: 1px solid rgba(88, 105, 44, 0.42);
  background: rgba(247, 249, 239, 0.95);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.timecards-canvas-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: end;
}

.timecards-canvas-panel__header h2 {
  margin: 0;
}

.timecards-canvas-panel__eyebrow {
  color: rgba(64, 85, 36, 0.82);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.timecards-canvas-panel__meta {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  color: rgba(38, 43, 23, 0.76);
  font-size: 0.86rem;
}

.timecards-canvas {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  min-width: 0;
}

.timecards-canvas__item {
  padding: 0.6rem;
  border: 2px solid rgba(62, 78, 36, 0.2);
  background: rgba(234, 239, 216, 0.88);
  align-self: start;
  min-width: 0;
  overflow: hidden;
}

.timecards-canvas__item--active {
  border-color: rgba(48, 121, 68, 0.66);
  box-shadow: 0 0 0 2px rgba(48, 121, 68, 0.16);
}

.timecards-canvas__item-header {
  display: flex;
  gap: 0.45rem;
  margin: 0 0 0.4rem;
}

.timecards-canvas__item-header-button {
  min-height: 2rem;
  padding: 0 0.75rem;
  border: 1px solid rgba(71, 82, 41, 0.2);
  background: rgba(255, 255, 255, 0.42);
  color: rgba(29, 33, 22, 0.84);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
}

.timecards-canvas__item-header-button--collapse {
  flex: 1 1 auto;
  width: 100%;
  justify-content: flex-end;
}

.timecards-canvas__item-header-button--edit {
  flex: 0 0 auto;
  min-width: 6.6rem;
  border-color: rgba(63, 120, 67, 0.28);
  background: rgba(245, 250, 238, 0.82);
  color: rgba(36, 65, 28, 0.94);
}

.timecards-canvas__item-header-button--active {
  border-color: rgba(63, 120, 67, 0.46);
  background: rgba(221, 241, 214, 0.96);
}

.timecards-canvas__item-header-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(82, 132, 76, 0.18);
}

.timecards-canvas__item-header-label {
  pointer-events: none;
}

.timecards-canvas__item-footer {
  margin-top: 0.45rem;
}

.timecards-canvas__item-footer-button {
  width: 100%;
  min-height: 2rem;
  padding: 0 0.75rem;
  border: 1px solid rgba(167, 53, 53, 0.24);
  background: rgba(255, 248, 246, 0.78);
  color: #8a2828;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
}

.timecards-canvas__item-footer-button:disabled {
  opacity: 0.48;
  cursor: default;
}

.timecards-canvas__item .timecard-card {
  overflow: visible;
}

.timecards-canvas__item-card-shell {
  width: 100%;
  min-width: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow: hidden;
}

.timecards-canvas__item-card-scale {
  display: inline-block;
  width: max-content;
  transform-origin: top center;
}

.timecards-canvas-empty {
  padding: 1rem;
  border: 1px dashed rgba(88, 105, 44, 0.38);
  background: rgba(239, 244, 226, 0.74);
  color: rgba(38, 43, 23, 0.82);
  text-align: center;
}

.timecards-canvas-empty--canvas {
  min-height: 18rem;
  display: grid;
  place-items: center;
}

@media (max-width: 960px) {
  .timecards-canvas {
    grid-template-columns: 1fr;
  }

  .timecards-canvas-panel__header {
    align-items: start;
    flex-direction: column;
  }

  .timecards-canvas-panel__meta {
    justify-content: flex-start;
  }
}
</style>
