<script setup lang="ts">
import { computed } from 'vue'
import SubmissionCountBadges from '@/components/common/SubmissionCountBadges.vue'

defineOptions({
  name: 'ControllerTimecardSummary',
})

interface Props {
  draftCount: number
  submittedCount: number
  totalHours?: number | null
  totalProduction?: number | null
  totalLine?: number | null
  totalCount?: number | null
  countLabel?: string
  align?: 'start' | 'end'
}

const props = withDefaults(defineProps<Props>(), {
  totalHours: null,
  totalProduction: null,
  totalLine: null,
  totalCount: null,
  countLabel: 'timecard',
  align: 'end',
})

const hasMetrics = computed(() => (
  props.totalHours != null && props.totalProduction != null && props.totalLine != null
))

const hasCount = computed(() => props.totalCount != null)

function formatMetric(value: number | null | undefined): string {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric) || Number.isNaN(numeric)) return '0'
  return numeric.toFixed(2).replace(/\.00$/, '')
}

function formatCurrency(value: number | null | undefined): string {
  return `$${Number(value ?? 0).toFixed(2)}`
}

const countText = computed(() => {
  if (!hasCount.value) return ''
  const suffix = props.totalCount === 1 ? '' : 's'
  return `${props.totalCount} ${props.countLabel}${suffix}`
})
</script>

<template>
  <div class="controller-timecard-summary small text-muted" :class="align === 'end' ? 'text-end' : 'text-start'">
    <div class="controller-timecard-summary__badges">
      <SubmissionCountBadges
        :draft-count="draftCount"
        :submitted-count="submittedCount"
        wrapper-class="controller-timecard-summary__badge-wrap"
      />
    </div>
    <div v-if="hasMetrics" class="controller-timecard-summary__metrics">
      {{ formatMetric(totalHours) }} hrs | {{ formatMetric(totalProduction) }} prod | {{ formatCurrency(totalLine) }}
    </div>
  <div v-if="hasCount" class="controller-timecard-summary__count">
      {{ countText }}
    </div>
  </div>
</template>
