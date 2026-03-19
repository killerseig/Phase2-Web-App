<script setup lang="ts">
import { computed } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import TimecardStatusBadge from '@/components/timecards/TimecardStatusBadge.vue'
import type { TimecardSummaryRow } from '@/components/timecards/timecardPageModels'

const props = defineProps<{
  open: boolean
  weekEndingDate: string
  weekRange: string
  summaryRows: TimecardSummaryRow[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const totals = computed(() => props.summaryRows.reduce(
  (summary, row) => {
    summary.hours += row.hours
    summary.production += row.production
    summary.lineTotal += row.lineTotal
    return summary
  },
  {
    hours: 0,
    production: 0,
    lineTotal: 0,
  },
))
</script>

<template>
  <BaseModal
    :open="open"
    :title="`Timecard Summary - Week ending ${weekEndingDate}`"
    size="lg"
    content-class="summary-modal-content"
    @close="emit('close')"
  >
    <div id="timecard-summary">
      <div class="text-muted small mb-3">{{ weekRange }}</div>
      <div class="table-responsive">
        <table class="table table-sm table-striped align-middle summary-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>#</th>
              <th class="text-center">Status</th>
              <th class="text-end">Hours</th>
              <th class="text-end">Production</th>
              <th class="text-end">Line Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in summaryRows" :key="row.id">
              <td>{{ row.employeeName }}</td>
              <td class="text-muted">{{ row.employeeNumber }}</td>
              <td class="text-center">
                <TimecardStatusBadge :status="row.status" />
              </td>
              <td class="text-end">{{ row.hours.toFixed(2) }}</td>
              <td class="text-end">{{ row.production.toFixed(2) }}</td>
              <td class="text-end">{{ row.lineTotal.toFixed(2) }}</td>
            </tr>
          </tbody>
          <tfoot v-if="summaryRows.length">
            <tr class="fw-semibold">
              <td colspan="3" class="text-end">Totals</td>
              <td class="text-end">{{ totals.hours.toFixed(2) }}</td>
              <td class="text-end">{{ totals.production.toFixed(2) }}</td>
              <td class="text-end">{{ totals.lineTotal.toFixed(2) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <template #footer>
      <button type="button" class="btn btn-secondary" @click="emit('close')">Close</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.summary-table th,
.summary-table td {
  padding: 0.5rem 0.55rem;
}

:deep(.summary-modal-content) {
  min-height: 0;
}
</style>
