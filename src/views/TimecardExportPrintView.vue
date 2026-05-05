<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import TimecardPrintCard from '@/components/timecards/TimecardPrintCard.vue'
import {
  loadTimecardPdfExportPayload,
  type TimecardPdfExportPayload,
} from '@/features/timecards/pdf-export'

const route = useRoute()

const payload = ref<TimecardPdfExportPayload | null>(null)
const loadError = ref('')
const autoPrinting = ref(false)
const pagedCards = computed(() => {
  const cards = payload.value?.cards ?? []
  const pages: typeof cards[] = []

  for (let index = 0; index < cards.length; index += 2) {
    pages.push(cards.slice(index, index + 2))
  }

  return pages
})

function formatGeneratedAt(value: number) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value)
}

async function triggerPrint() {
  if (!payload.value || autoPrinting.value) return
  autoPrinting.value = true
  await nextTick()
  window.setTimeout(() => {
    window.print()
    autoPrinting.value = false
  }, 150)
}

onMounted(async () => {
  const exportId = typeof route.query.exportId === 'string' ? route.query.exportId : undefined
  const nextPayload = loadTimecardPdfExportPayload(exportId)

  if (!nextPayload) {
    loadError.value = 'No timecard export data was found. Return to Timecard Export and try again.'
    return
  }

  payload.value = nextPayload

  await triggerPrint()
})
</script>

<template>
  <div class="timecard-print-view">
    <header v-if="payload" class="timecard-print-view__screen-toolbar">
      <div class="timecard-print-view__screen-copy">
        <strong>{{ payload.title }}</strong>
        <span>{{ payload.subtitle }}</span>
        <span>Generated {{ formatGeneratedAt(payload.generatedAt) }}</span>
      </div>
      <button class="timecard-print-view__print-button" type="button" @click="triggerPrint">
        Print PDF
      </button>
    </header>

    <div v-if="loadError" class="timecard-print-view__empty">
      {{ loadError }}
    </div>

    <main v-else-if="payload" class="timecard-print-view__document">
      <article
        v-for="(pageCards, pageIndex) in pagedCards"
        :key="`${payload.exportId}-page-${pageIndex}`"
        class="timecard-print-view__page"
      >
        <div class="timecard-print-view__page-grid">
          <div
            v-for="card in pageCards"
            :key="`${payload.exportId}-${card.id}`"
            class="timecard-print-view__card-shell"
          >
            <TimecardPrintCard
              class="timecard-print-view__workbook-card"
              :card="card"
              :week-end-date="card.exportWeekEndDate"
              :burden="card.exportBurden"
            />
          </div>

          <div
            v-if="pageCards.length === 1"
            class="timecard-print-view__card-shell timecard-print-view__card-shell--empty"
            aria-hidden="true"
          ></div>
        </div>
      </article>
    </main>
  </div>
</template>

<style scoped>
.timecard-print-view {
  min-height: 100vh;
  background: #f4f4ef;
  color: #111;
}

.timecard-print-view__screen-toolbar {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(8px);
}

.timecard-print-view__screen-copy {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.timecard-print-view__screen-copy strong {
  font-size: 1rem;
}

.timecard-print-view__screen-copy span {
  color: rgba(17, 17, 17, 0.74);
  font-size: 0.86rem;
}

.timecard-print-view__print-button {
  min-height: 2.4rem;
  padding: 0 1rem;
  border: 1px solid rgba(71, 82, 41, 0.48);
  background: linear-gradient(180deg, #ffffff 0%, #e6ead4 100%);
  color: #191b13;
  font-weight: 600;
}

.timecard-print-view__empty {
  max-width: 42rem;
  margin: 2rem auto;
  padding: 1rem 1.25rem;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: #fff;
}

.timecard-print-view__document {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  justify-content: center;
}

.timecard-print-view__page {
  display: grid;
  width: 11in;
  min-height: 8.5in;
  box-sizing: border-box;
  padding: 0.25in;
  background: #fff;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  break-after: page;
  page-break-after: always;
}

.timecard-print-view__page:last-child {
  break-after: auto;
  page-break-after: auto;
}

.timecard-print-view__page-grid {
  display: grid;
  grid-template-columns: repeat(2, 5.078in);
  gap: 0.344in;
  justify-content: center;
  align-items: start;
}

.timecard-print-view__card-shell {
  width: 5.078in;
  overflow: visible;
}

.timecard-print-view__card-shell--empty {
  visibility: hidden;
}

@page {
  size: letter landscape;
  margin: 0.25in;
}

@media print {
  .timecard-print-view {
    min-height: auto;
    background: #fff;
  }

  .timecard-print-view__screen-toolbar {
    display: none;
  }

  .timecard-print-view__document {
    gap: 0;
    padding: 0;
  }

  .timecard-print-view__page {
    width: auto;
    min-height: auto;
    padding: 0;
    box-shadow: none;
  }
}
</style>
