<script setup lang="ts">
import BaseCard from '@/components/common/BaseCard.vue'
import TimecardStatusBadge from '@/components/timecards/TimecardStatusBadge.vue'
import { getTimecardDisplayName, type TimecardModel } from '@/utils/timecardUtils'

defineOptions({
  name: 'TimecardSelectedMetaCard',
})

defineProps<{
  timecard: TimecardModel
}>()
</script>

<template>
  <BaseCard
    card-class="timecard-selected-meta-card"
    header-class="timecard-selected-meta-card__header"
    body-class="timecard-selected-meta-card__body"
  >
    <template #header>
      <div class="timecard-selected-meta-card__heading">
        <div class="timecard-selected-meta-card__heading-copy">
          <div class="timecard-selected-meta-card__eyebrow">
            Selected Card
          </div>
          <div class="timecard-selected-meta-card__name">
            {{ getTimecardDisplayName(timecard) }}
          </div>
        </div>

        <TimecardStatusBadge :status="timecard.status" />
      </div>
    </template>

    <div class="timecard-selected-meta-card__meta">
      <span>Employee #{{ timecard.employeeNumber || '-' }}</span>
      <span aria-hidden="true">|</span>
      <span>{{ timecard.occupation || 'No occupation' }}</span>
    </div>
  </BaseCard>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.timecard-selected-meta-card {
  background: $surface;
}

.timecard-selected-meta-card__header {
  padding: 0.75rem 0.9rem 0.5rem;
}

.timecard-selected-meta-card__body {
  padding: 0 0.9rem 0.75rem;
}

.timecard-selected-meta-card__heading {
  align-items: start;
  display: flex;
  gap: 0.75rem;
  justify-content: space-between;
}

.timecard-selected-meta-card__heading-copy {
  min-width: 0;
}

.timecard-selected-meta-card__eyebrow {
  color: rgba($text-muted, 0.96);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1;
  text-transform: uppercase;
}

.timecard-selected-meta-card__name {
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.1;
  margin-top: 0.45rem;
  overflow-wrap: anywhere;
}

.timecard-selected-meta-card__meta {
  color: $text-muted;
  display: flex;
  flex-wrap: wrap;
  font-size: 0.84rem;
  gap: 0.35rem;
  line-height: 1.25;
}

@media (max-width: 767px) {
  .timecard-selected-meta-card__header {
    padding: 0.65rem 0.8rem 0.45rem;
  }

  .timecard-selected-meta-card__body {
    padding: 0 0.8rem 0.65rem;
  }

  .timecard-selected-meta-card__name {
    font-size: 0.98rem;
  }
}
</style>
