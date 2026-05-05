<script setup lang="ts">
import { computed, ref } from 'vue'
import TimecardWorkbookCard from '@/components/timecards/TimecardWorkbookCard.vue'
import { buildEmployeeCard } from '@/features/timecards/workbook'
import type { TimecardCardRecord } from '@/types/domain'

const linkedJobNumber = ref('9411')
const weekEndDate = ref('2026-05-09')
const nextId = ref(1)

function createCard(): TimecardCardRecord {
  return {
    id: `e2e-card-${nextId.value++}`,
    ...buildEmployeeCard(
      {
        employeeId: 'employee-e2e',
        firstName: 'Saturnino',
        lastName: 'Acevedo',
        employeeNumber: '124',
        occupation: 'Framer Rocker',
        wageRate: 0,
        isContractor: false,
      },
      weekEndDate.value,
      0,
      linkedJobNumber.value,
    ),
  }
}

const card = ref<TimecardCardRecord>(createCard())

function resetCard() {
  card.value = createCard()
}

const firstJobNumbers = computed(() => card.value.lines.slice(0, 4).map((line) => line.jobNumber).join('|'))
const allLinesPrefilled = computed(() => (
  card.value.lines.every((line) => line.jobNumber === linkedJobNumber.value)
))
</script>

<template>
  <main class="e2e-timecard-page" data-testid="e2e-timecard-page">
    <section class="e2e-timecard-toolbar">
      <label class="e2e-timecard-field">
        <span>Linked Job #</span>
        <input v-model="linkedJobNumber" data-testid="linked-job-number" type="text" />
      </label>

      <label class="e2e-timecard-field">
        <span>Week Ending</span>
        <input v-model="weekEndDate" data-testid="week-ending" type="date" />
      </label>

      <button data-testid="create-card" type="button" @click="resetCard">
        Create Card
      </button>
    </section>

    <section class="e2e-timecard-summary">
      <div data-testid="prefill-status">{{ allLinesPrefilled ? 'prefilled' : 'not-prefilled' }}</div>
      <div data-testid="job-number-summary">{{ firstJobNumbers }}</div>
    </section>

    <TimecardWorkbookCard
      :card="card"
      :week-end-date="weekEndDate"
      :read-only="false"
      :employee-header-locked="false"
      :show-employee-wage="true"
      :show-cost-values="true"
    />
  </main>
</template>

<style scoped>
.e2e-timecard-page {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  justify-items: start;
}

.e2e-timecard-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: end;
}

.e2e-timecard-field {
  display: grid;
  gap: 0.25rem;
}

.e2e-timecard-summary {
  display: grid;
  gap: 0.25rem;
  font-family: monospace;
}
</style>
