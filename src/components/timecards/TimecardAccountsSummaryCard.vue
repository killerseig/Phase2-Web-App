<script setup lang="ts">
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import type { TimecardAccountSummaryItem } from '@/types/timecards'

defineOptions({
  name: 'TimecardAccountsSummaryCard',
})

defineProps<{
  employeeCount: number
  draftCount: number
  submittedCount: number
  accounts: TimecardAccountSummaryItem[]
}>()

function formatNumber(value: number): string {
  return Number(value || 0).toFixed(2)
}
</script>

<template>
  <AppSectionCard
    class="timecard-summary-card"
    title="Week Summary"
    icon="bi bi-calculator"
    body-class="timecard-summary-card__body d-flex flex-column gap-3"
  >
    <div class="timecard-summary-stats">
      <div class="timecard-summary-stats__item">
        <div class="timecard-summary-stats__label">Employees</div>
        <div class="timecard-summary-stats__value">{{ employeeCount }}</div>
      </div>
      <div class="timecard-summary-stats__item timecard-summary-stats__item--accent">
        <div class="timecard-summary-stats__label">Draft</div>
        <div class="timecard-summary-stats__value">{{ draftCount }}</div>
      </div>
      <div class="timecard-summary-stats__item">
        <div class="timecard-summary-stats__label">Submitted</div>
        <div class="timecard-summary-stats__value">{{ submittedCount }}</div>
      </div>
    </div>

    <div class="timecard-summary-accounts">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <div class="fw-semibold">Accounts Summary</div>
        <small class="text-muted">{{ accounts.length }} line{{ accounts.length === 1 ? '' : 's' }}</small>
      </div>

      <AppEmptyState
        v-if="!accounts.length"
        icon="bi bi-table"
        icon-class="fs-4"
        title="No account totals yet"
        message="Account lines will appear as hours and production are entered."
        message-class="small mb-0"
      />

      <div v-else class="timecard-summary-accounts__table-wrap">
        <table class="table table-sm mb-0 timecard-summary-accounts__table">
          <colgroup>
            <col class="timecard-summary-accounts__col--job" />
            <col class="timecard-summary-accounts__col--area" />
            <col class="timecard-summary-accounts__col--acct" />
            <col class="timecard-summary-accounts__col--hours" />
            <col class="timecard-summary-accounts__col--prod" />
          </colgroup>
          <thead>
            <tr>
              <th>Job #</th>
              <th>Area</th>
              <th>Acct</th>
              <th class="text-end">Hours</th>
              <th class="text-end">Prod</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="account in accounts" :key="account.key">
              <td>{{ account.jobNumber || '-' }}</td>
              <td>{{ account.subsectionArea || '-' }}</td>
              <td>{{ account.account || '-' }}</td>
              <td class="text-end">{{ formatNumber(account.hoursTotal) }}</td>
              <td class="text-end">{{ formatNumber(account.productionTotal) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </AppSectionCard>
</template>
