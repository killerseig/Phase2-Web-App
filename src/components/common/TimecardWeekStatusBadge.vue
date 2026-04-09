<script setup lang="ts">
import { computed } from 'vue'
import AppBadge from '@/components/common/AppBadge.vue'

defineOptions({
  name: 'TimecardWeekStatusBadge',
})

interface Props {
  status?: string | null
  periodEndDate?: string | null
  currentWeekEnd: string
  currentWeekLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  status: '',
  periodEndDate: null,
  currentWeekLabel: '',
})

const isSubmittedThisWeek = computed(() => (
  props.status === 'submitted' && props.periodEndDate === props.currentWeekEnd
))

const badgeLabel = computed(() => (
  isSubmittedThisWeek.value ? 'Weekly timecards submitted' : 'Weekly timecards pending'
))

const badgeVariantClass = computed(() => (
  isSubmittedThisWeek.value ? 'text-bg-success' : 'text-bg-danger'
))

const badgeTitle = computed(() => {
  if (!props.currentWeekLabel) return undefined
  return `Timecards for week ${props.currentWeekLabel}: ${isSubmittedThisWeek.value ? 'Submitted' : 'Pending submission'}`
})
</script>

<template>
  <AppBadge
    :label="badgeLabel"
    :variant-class="badgeVariantClass"
    :title="badgeTitle"
  />
</template>
