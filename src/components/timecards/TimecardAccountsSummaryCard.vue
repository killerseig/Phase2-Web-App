<script setup lang="ts">
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import AppStatCard from '@/components/common/AppStatCard.vue'
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
    title="Week Summary"
    icon="bi bi-calculator"
    body-class="timecard-summary-card__body d-flex flex-column gap-2"
  >
    <div class="timecard-summary-stats">
      <AppStatCard
        label="Employees"
        :value="employeeCount"
        card-class="timecard-summary-stat-card"
      />
      <AppStatCard
        label="Draft"
        :value="draftCount"
        tone="accent"
        card-class="timecard-summary-stat-card"
      />
      <AppStatCard
        label="Submitted"
        :value="submittedCount"
        card-class="timecard-summary-stat-card"
      />
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

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.timecard-summary-stats {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.timecard-summary-card__body {
  min-height: 0;
}

.timecard-summary-accounts__table-wrap {
  max-height: 13.5rem;
  overflow-x: hidden;
  overflow-y: auto;
}

.timecard-summary-accounts__table {
  --bs-table-bg: transparent;
  --bs-table-border-color: rgba($border-color, 0.55);
  color: $body-color;
  font-size: 0.88rem;
  table-layout: fixed;
  width: 100%;
}

.timecard-summary-accounts__table thead th {
  background: rgba($surface-2, 0.82);
  border-bottom-width: 1px;
  color: $text-muted;
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  padding: 0.5rem 0.45rem 0.4rem;
  position: static;
  text-transform: uppercase;
  white-space: nowrap;
  word-break: keep-all;
}

.timecard-summary-accounts__table tbody td {
  background: rgba($surface-2, 0.38);
  padding: 0.6rem 0.45rem;
  vertical-align: middle;
}

.timecard-summary-accounts__table tbody td:nth-child(1),
.timecard-summary-accounts__table tbody td:nth-child(2),
.timecard-summary-accounts__table tbody td:nth-child(3) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timecard-summary-accounts__col--job {
  width: 20%;
}

.timecard-summary-accounts__col--area,
.timecard-summary-accounts__col--acct {
  width: 14%;
}

.timecard-summary-accounts__col--hours,
.timecard-summary-accounts__col--prod {
  width: 26%;
}

.timecard-summary-stats :deep(.timecard-summary-stat-card .card-body) {
  min-width: 0;
  padding: 0.75rem;
}

.timecard-summary-stats :deep(.timecard-summary-stat-card .app-stat-card__label) {
  font-size: 0.62rem;
  letter-spacing: 0.02em;
  line-height: 1.1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timecard-summary-stats :deep(.timecard-summary-stat-card .app-stat-card__value) {
  font-size: clamp(1.25rem, 1.7vw, 1.65rem);
  margin-top: 0.2rem;
}

@media (max-width: 768px) {
  .timecard-summary-stats {
    grid-template-columns: 1fr;
  }
}
</style>
