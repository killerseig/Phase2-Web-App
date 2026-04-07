<script setup lang="ts">
defineProps<{
  loadedWeekLabel: string
  summary: {
    totalCount: number
    submittedCount: number
    draftCount: number
    totalHours: number
  }
}>()
</script>

<template>
  <section class="controller-summary-stats">
    <header class="controller-summary-stats__header">
      <span class="controller-summary-stats__eyebrow">Loaded Week</span>
      <strong class="controller-summary-stats__week">{{ loadedWeekLabel }}</strong>
    </header>

    <div class="controller-summary-stats__grid">
      <article class="controller-summary-stats__item">
        <span class="controller-summary-stats__label">Timecards</span>
        <strong class="controller-summary-stats__value">{{ summary.totalCount }}</strong>
      </article>

      <article class="controller-summary-stats__item">
        <span class="controller-summary-stats__label">Submitted</span>
        <strong class="controller-summary-stats__value controller-summary-stats__value--success">
          {{ summary.submittedCount }}
        </strong>
      </article>

      <article class="controller-summary-stats__item">
        <span class="controller-summary-stats__label">Drafts</span>
        <strong class="controller-summary-stats__value controller-summary-stats__value--warning">
          {{ summary.draftCount }}
        </strong>
      </article>

      <article class="controller-summary-stats__item">
        <span class="controller-summary-stats__label">Total Hours</span>
        <strong class="controller-summary-stats__value">
          {{ Number(summary.totalHours ?? 0).toFixed(2).replace(/\.00$/, '') }}
        </strong>
      </article>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.controller-summary-stats {
  background: $surface-2;
  border: 1px solid $border-color;
  border-radius: 1rem;
  display: grid;
  gap: 0.65rem;
  padding: 0.75rem 0.8rem 0.8rem;
}

.controller-summary-stats__header {
  align-items: baseline;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.6rem;
}

.controller-summary-stats__eyebrow {
  color: $text-muted;
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.controller-summary-stats__week {
  font-size: 0.98rem;
  font-weight: 700;
}

.controller-summary-stats__grid {
  display: grid;
  gap: 0.55rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.controller-summary-stats__item {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.85rem;
  display: grid;
  gap: 0.2rem;
  min-width: 0;
  padding: 0.55rem 0.65rem;
}

.controller-summary-stats__label {
  color: $text-muted;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.controller-summary-stats__value {
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1;
}

.controller-summary-stats__value--success {
  color: $success;
}

.controller-summary-stats__value--warning {
  color: $warning;
}

@media (max-width: 575px) {
  .controller-summary-stats__grid {
    grid-template-columns: 1fr;
  }
}
</style>
