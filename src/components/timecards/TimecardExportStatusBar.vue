<script setup lang="ts">
import { computed, reactive, ref, type ComponentPublicInstance } from 'vue'

export interface TimecardExportStatusSignal {
  key: string
  text: string
  tone: 'default' | 'success' | 'error'
}

const props = defineProps<{
  signals: readonly TimecardExportStatusSignal[]
}>()

const statusScrollerRef = ref<HTMLDivElement | null>(null)
const statusSignalItemRefs = ref<HTMLDivElement[]>([])
const activeStatusSignalIndex = ref(0)
const MOBILE_STATUS_VISIBLE_COUNT = 2

const statusScrollerDrag = reactive({
  pointerId: null as number | null,
  startX: 0,
  startScrollLeft: 0,
  dragging: false,
})

const canScrollStatusBackward = computed(() => activeStatusSignalIndex.value > 0)
const canScrollStatusForward = computed(() => activeStatusSignalIndex.value < getMaxStatusSignalStartIndex())

function setStatusScrollerRef(element: Element | ComponentPublicInstance | null) {
  statusScrollerRef.value = element instanceof HTMLDivElement ? element : null
}

function setStatusSignalItemRef(index: number, element: Element | ComponentPublicInstance | null) {
  if (!(element instanceof HTMLDivElement)) {
    delete statusSignalItemRefs.value[index]
    return
  }

  statusSignalItemRefs.value[index] = element
}

function getMaxStatusSignalStartIndex() {
  return Math.max(0, props.signals.length - MOBILE_STATUS_VISIBLE_COUNT)
}

function getNearestStatusSignalIndex() {
  const scroller = statusScrollerRef.value
  const items = statusSignalItemRefs.value
  if (!scroller || !items.length) return 0

  const currentLeft = scroller.scrollLeft
  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY

  items.forEach((item, index) => {
    if (!item) return
    const distance = Math.abs(item.offsetLeft - currentLeft)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  })

  return nearestIndex
}

function syncStatusSignalIndex() {
  activeStatusSignalIndex.value = Math.min(getNearestStatusSignalIndex(), getMaxStatusSignalStartIndex())
}

function scrollStatusSignalTo(index: number, behavior: ScrollBehavior = 'smooth') {
  const scroller = statusScrollerRef.value
  const clampedIndex = Math.max(0, Math.min(getMaxStatusSignalStartIndex(), index))
  const item = statusSignalItemRefs.value[clampedIndex]
  if (!scroller || !item) return

  scroller.scrollTo({
    left: item.offsetLeft,
    behavior,
  })
  activeStatusSignalIndex.value = clampedIndex
}

function scrollStatusSignals(direction: -1 | 1) {
  const nextIndex = Math.max(0, Math.min(getMaxStatusSignalStartIndex(), activeStatusSignalIndex.value + direction))
  scrollStatusSignalTo(nextIndex)
}

function beginStatusScrollerDrag(event: PointerEvent) {
  if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
  if (event.pointerType === 'mouse' && event.button !== 0) return

  const scroller = statusScrollerRef.value
  if (!scroller) return

  statusScrollerDrag.pointerId = event.pointerId
  statusScrollerDrag.startX = event.clientX
  statusScrollerDrag.startScrollLeft = scroller.scrollLeft
  statusScrollerDrag.dragging = false

  try {
    scroller.setPointerCapture(event.pointerId)
  } catch {
    // Ignore pointer capture failures.
  }
}

function handleStatusScrollerDrag(event: PointerEvent) {
  if (statusScrollerDrag.pointerId !== event.pointerId) return

  const scroller = statusScrollerRef.value
  if (!scroller) return

  const deltaX = event.clientX - statusScrollerDrag.startX
  if (!statusScrollerDrag.dragging && Math.abs(deltaX) > 3) {
    statusScrollerDrag.dragging = true
  }

  if (!statusScrollerDrag.dragging) return

  if (event.cancelable) {
    event.preventDefault()
  }

  scroller.scrollLeft = statusScrollerDrag.startScrollLeft - deltaX
  syncStatusSignalIndex()
}

function endStatusScrollerDrag(event: PointerEvent) {
  if (statusScrollerDrag.pointerId !== event.pointerId) return

  const scroller = statusScrollerRef.value
  if (scroller) {
    try {
      if (scroller.hasPointerCapture(event.pointerId)) {
        scroller.releasePointerCapture(event.pointerId)
      }
    } catch {
      // Ignore pointer capture release failures.
    }
  }

  const shouldSnap = statusScrollerDrag.dragging
  statusScrollerDrag.pointerId = null
  statusScrollerDrag.dragging = false

  if (shouldSnap) {
    scrollStatusSignalTo(getNearestStatusSignalIndex())
  }
}
</script>

<template>
  <fieldset class="timecard-export-status-bar timecards-toolbar__group timecards-toolbar__group--status-bar">
    <legend class="timecard-export-status-bar__legend">Status</legend>
    <div class="timecard-export-status-bar__strip timecard-export-status-bar__strip--desktop">
      <span
        v-for="signal in signals"
        :key="signal.key"
        class="timecard-export-status-bar__signal"
        :class="{
          'timecard-export-status-bar__signal--success': signal.tone === 'success',
          'timecard-export-status-bar__signal--error': signal.tone === 'error',
        }"
      >
        {{ signal.text }}
      </span>
    </div>

    <div class="timecard-export-status-bar__scroll">
      <button
        type="button"
        class="timecard-export-status-bar__scroll-button"
        :disabled="!canScrollStatusBackward"
        @click="scrollStatusSignals(-1)"
      >
        <span class="timecard-export-status-bar__carousel-glyph" aria-hidden="true">&lt;</span>
      </button>

      <div
        :ref="setStatusScrollerRef"
        class="timecard-export-status-bar__scroller"
        :class="{ 'timecard-export-status-bar__scroller--dragging': statusScrollerDrag.dragging }"
        @scroll.passive="syncStatusSignalIndex"
        @pointerdown="beginStatusScrollerDrag"
        @pointermove="handleStatusScrollerDrag"
        @pointerup="endStatusScrollerDrag"
        @pointercancel="endStatusScrollerDrag"
      >
        <div
          v-for="(signal, index) in signals"
          :key="signal.key"
          :ref="(element) => setStatusSignalItemRef(index, element)"
          class="timecard-export-status-bar__carousel-item"
        >
          <span
            class="timecard-export-status-bar__signal"
            :class="{
              'timecard-export-status-bar__signal--success': signal.tone === 'success',
              'timecard-export-status-bar__signal--error': signal.tone === 'error',
            }"
          >
            {{ signal.text }}
          </span>
        </div>
      </div>

      <button
        type="button"
        class="timecard-export-status-bar__scroll-button"
        :disabled="!canScrollStatusForward"
        @click="scrollStatusSignals(1)"
      >
        <span class="timecard-export-status-bar__carousel-glyph" aria-hidden="true">&gt;</span>
      </button>
    </div>
  </fieldset>
</template>

<style scoped>
.timecard-export-status-bar {
  display: grid;
  gap: var(--timecards-toolbar-group-gap);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  grid-column: 1 / -1;
}

.timecard-export-status-bar__legend {
  padding: 0;
  color: rgba(64, 85, 36, 0.82);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.timecard-export-status-bar__strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.55rem;
}

.timecard-export-status-bar__scroll {
  display: none;
  width: 100%;
}

.timecard-export-status-bar__carousel-item {
  display: flex;
  justify-content: center;
  flex: 0 0 100%;
  width: 100%;
  min-width: 100%;
  scroll-snap-align: start;
}

.timecard-export-status-bar__carousel-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
  user-select: none;
}

.timecard-export-status-bar__scroll-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  min-width: 2rem;
  height: var(--timecards-toolbar-control-height);
  border: 1px solid var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: var(--timecards-toolbar-control-bg-muted);
  color: rgba(64, 85, 36, 0.82);
  box-shadow: none;
}

.timecard-export-status-bar__scroll-button:hover:not(:disabled) {
  border-color: var(--timecards-toolbar-control-border-strong);
  background: rgba(245, 248, 233, 0.98);
}

.timecard-export-status-bar__scroll-button:disabled {
  opacity: 0.4;
}

.timecard-export-status-bar__scroller {
  --timecards-status-gap: 0.45rem;
  display: flex;
  gap: var(--timecards-status-gap);
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  scrollbar-width: none;
  -ms-overflow-style: none;
  overscroll-behavior-x: contain;
  cursor: grab;
}

.timecard-export-status-bar__scroller::-webkit-scrollbar {
  display: none;
}

.timecard-export-status-bar__scroller--dragging {
  scroll-snap-type: none;
  scroll-behavior: auto;
  cursor: grabbing;
}

.timecard-export-status-bar__signal {
  min-height: var(--timecards-toolbar-control-height);
  padding: 0 0.8rem;
  border: 1px solid var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: var(--timecards-toolbar-control-bg-muted);
  display: inline-flex;
  align-items: center;
  font-size: 0.84rem;
  font-weight: 600;
}

.timecard-export-status-bar__signal--success {
  border-color: rgba(46, 109, 61, 0.36);
  color: #1e5c34;
  background: rgba(221, 241, 214, 0.96);
}

.timecard-export-status-bar__signal--error {
  border-color: rgba(167, 53, 53, 0.36);
  color: #8a2828;
  background: rgba(248, 224, 220, 0.96);
}

@media (max-width: 960px) {
  .timecard-export-status-bar__strip--desktop {
    display: none;
  }

  .timecard-export-status-bar__scroll {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.35rem;
  }

  .timecard-export-status-bar__carousel-item {
    flex: 0 0 calc((100% - var(--timecards-status-gap)) / 2);
    min-width: calc((100% - var(--timecards-status-gap)) / 2);
  }

  .timecard-export-status-bar__signal {
    width: 100%;
    justify-content: center;
    white-space: nowrap;
  }
}
</style>
