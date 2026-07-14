<script setup lang="ts">
interface AccountSummaryRow {
  key: string
  jobNumber: string
  subsectionArea: string
  account: string
  hoursTotal: number
  productionTotal: number
}

defineProps<{
  cardCount: number
  totalHours: number
  totalProduction: number
  accountsSummary: readonly AccountSummaryRow[]
}>()
</script>

<template>
  <section class="timecard-summary">
    <div class="timecard-summary__header">
      <span class="timecard-summary__eyebrow">Current Results</span>
      <h2>Totals</h2>
    </div>

    <div class="timecard-summary__stats">
      <div>
        <span>Cards</span>
        <strong>{{ cardCount }}</strong>
      </div>
      <div>
        <span>Total Hours</span>
        <strong>{{ totalHours.toFixed(1) }}</strong>
      </div>
      <div>
        <span>Production</span>
        <strong>{{ totalProduction.toFixed(1) }}</strong>
      </div>
    </div>

    <div class="timecard-summary__table-wrap">
      <table class="timecard-summary__table">
        <thead>
          <tr>
            <th>Job Number</th>
            <th>Area</th>
            <th>Account</th>
            <th>Total Hours</th>
            <th>Production</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="account in accountsSummary" :key="account.key">
            <td>{{ account.jobNumber || '-' }}</td>
            <td>{{ account.subsectionArea || '-' }}</td>
            <td>{{ account.account || '-' }}</td>
            <td>{{ account.hoursTotal.toFixed(1) }}</td>
            <td>{{ account.productionTotal.toFixed(1) }}</td>
          </tr>
          <tr v-if="!accountsSummary.length">
            <td colspan="5" class="timecard-summary__empty">
              No account totals yet.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.timecard-summary {
  display: grid;
  gap: 0.9rem;
  margin-top: 1rem;
  padding: 0.9rem;
  border: 1px solid rgba(88, 105, 44, 0.42);
  background: rgba(247, 249, 239, 0.95);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.timecard-summary__header {
  display: grid;
  gap: 0.15rem;
}

.timecard-summary__header h2 {
  margin: 0;
}

.timecard-summary__eyebrow {
  color: rgba(64, 85, 36, 0.82);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.timecard-summary__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.75rem;
}

.timecard-summary__stats div {
  display: grid;
  gap: 0.2rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid rgba(71, 82, 41, 0.28);
  background: rgba(241, 245, 229, 0.92);
}

.timecard-summary__stats span {
  color: rgba(38, 43, 23, 0.76);
  font-size: 0.78rem;
}

.timecard-summary__table-wrap {
  overflow: auto;
}

.timecard-summary__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.timecard-summary__table th,
.timecard-summary__table td {
  padding: 0.32rem 0.24rem;
  border: 1px solid rgba(80, 93, 49, 0.38);
  text-align: left;
}

.timecard-summary__table th {
  background: rgba(223, 229, 199, 0.92);
  font-weight: 700;
}

.timecard-summary__empty {
  color: rgba(38, 43, 23, 0.76);
  font-size: 0.76rem;
}

@media (max-width: 960px) {
  .timecard-summary__stats {
    grid-template-columns: 1fr;
  }
}
</style>
