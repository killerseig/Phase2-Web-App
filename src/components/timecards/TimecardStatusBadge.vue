<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/common/StatusBadge.vue'

defineOptions({
  name: 'TimecardStatusBadge',
})

type TimecardBadgeVariant = 'summary' | 'editor'

interface Props {
  status: string
  variant?: TimecardBadgeVariant
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'summary',
})

const statusMapByVariant: Record<TimecardBadgeVariant, Record<string, { label: string; class: string }>> = {
  summary: {
    draft: { label: 'Draft', class: 'text-bg-warning text-dark' },
    submitted: { label: 'Submitted', class: 'text-bg-success' },
  },
  editor: {
    draft: { label: 'Draft', class: 'bg-warning text-dark' },
    submitted: { label: 'Submitted', class: 'bg-success' },
  },
}

const statusMap = computed(() => statusMapByVariant[props.variant])
</script>

<template>
  <StatusBadge :status="status" :status-map="statusMap" />
</template>
