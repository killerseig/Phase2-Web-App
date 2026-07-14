<script setup lang="ts">
import type { DailyLogSiteInfoFieldSchema } from '@/features/dailyLogs/schema'

type SiteInfoValues = Record<DailyLogSiteInfoFieldSchema['key'], string>

defineProps<{
  fields: readonly DailyLogSiteInfoFieldSchema[]
  siteInfo: SiteInfoValues
}>()
</script>

<template>
  <article class="daily-log-site-info-card daily-logs-card">
    <header class="daily-log-site-info-card__header">
      <div>
        <span class="daily-log-site-info-card__eyebrow">Job Information</span>
        <h2 class="daily-log-site-info-card__title">Site Info</h2>
      </div>
    </header>

    <div class="daily-log-site-info-card__grid">
      <label
        v-for="field in fields"
        :key="field.key"
        class="daily-log-site-info-card__field"
      >
        <span>{{ field.label }}</span>
        <div class="daily-log-site-info-card__value">{{ siteInfo[field.key] || '-' }}</div>
      </label>
    </div>
  </article>
</template>

<style scoped>
.daily-log-site-info-card {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0)),
    rgba(29, 38, 49, 0.92);
  box-shadow: var(--shadow);
}

.daily-log-site-info-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem;
}

.daily-log-site-info-card__eyebrow {
  color: var(--accent-strong);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.daily-log-site-info-card__title {
  margin: 0.2rem 0 0;
  font-size: 1.05rem;
}

.daily-log-site-info-card__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.daily-log-site-info-card__field {
  display: grid;
  gap: 0.45rem;
  color: var(--text-muted);
}

.daily-log-site-info-card__value {
  display: block;
  width: 100%;
  min-height: auto;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--text);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.35;
}

@media (max-width: 920px) {
  .daily-log-site-info-card__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .daily-log-site-info-card__grid {
    grid-template-columns: 1fr;
  }
}
</style>
