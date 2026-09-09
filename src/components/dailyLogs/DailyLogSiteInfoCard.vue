<script setup lang="ts">
import AppCard from '@/components/common/AppCard.vue'
import AppSectionHeader from '@/components/common/AppSectionHeader.vue'
import type { DailyLogSiteInfoFieldSchema } from '@/features/dailyLogs/schema'

type SiteInfoValues = Record<DailyLogSiteInfoFieldSchema['key'], string>

defineProps<{
  fields: readonly DailyLogSiteInfoFieldSchema[]
  siteInfo: SiteInfoValues
}>()
</script>

<template>
  <AppCard class="daily-log-site-info-card daily-logs-card">
    <AppSectionHeader
      class="daily-log-site-info-card__header"
      eyebrow="Job Information"
      title="Site Info"
      title-tag="h2"
    />

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
  </AppCard>
</template>

<style scoped>
.daily-log-site-info-card {
  --app-section-header-copy-gap: 0.2rem;
  --app-section-header-eyebrow-font-size: var(--font-size-eyebrow);
  --app-section-header-eyebrow-letter-spacing: var(--letter-spacing-eyebrow);
  --app-section-header-title-color: var(--text);
  --app-section-header-title-font-size: var(--font-size-section-title);
  --app-section-header-title-font-weight: var(--font-weight-heading);
  --app-section-header-title-letter-spacing: normal;
  --app-section-header-title-text-transform: none;
}

.daily-log-site-info-card__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--form-gap);
}

.daily-log-site-info-card__field {
  display: grid;
  gap: var(--field-gap);
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
