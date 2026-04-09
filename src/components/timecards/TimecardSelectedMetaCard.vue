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
