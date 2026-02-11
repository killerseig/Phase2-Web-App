<script lang="ts">
export default {
  name: 'StatusBadge',
}

const defaultStatusMap: Record<string, { label: string; class: string }> = {
  draft: { label: 'Draft', class: 'text-bg-secondary' },
  submitted: { label: 'Submitted', class: 'text-bg-info' },
  ordered: { label: 'Ordered', class: 'text-bg-warning' },
  received: { label: 'Received', class: 'text-bg-success' },
  active: { label: 'Active', class: 'text-bg-success' },
  inactive: { label: 'Inactive', class: 'text-bg-secondary' },
  archived: { label: 'Archived', class: 'text-bg-dark' },
}
</script>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  status: string
  statusMap?: Record<string, { label: string; class: string }>
}

const props = withDefaults(defineProps<Props>(), {
  statusMap: () => defaultStatusMap,
})

const statusInfo = computed(() => {
  const map = props.statusMap
  return map[props.status] || { label: props.status, class: 'text-bg-secondary' }
})
</script>

<template>
  <span :class="`badge ${statusInfo.class}`">
    {{ statusInfo.label }}
  </span>
</template>
