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
