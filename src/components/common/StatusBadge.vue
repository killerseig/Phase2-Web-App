Okay<script setup lang="ts">
import { computed } from 'vue'
import AppBadge from '@/components/common/AppBadge.vue'

defineOptions({
  name: 'StatusBadge',
})

const defaultStatusMap: Record<string, { label: string; class: string }> = {
  draft: { label: 'Draft', class: 'text-bg-secondary' },
  submitted: { label: 'Submitted', class: 'text-bg-info' },
  ordered: { label: 'Ordered', class: 'text-bg-warning' },
  received: { label: 'Received', class: 'text-bg-success' },
  active: { label: 'Active', class: 'text-bg-success' },
  inactive: { label: 'Inactive', class: 'text-bg-secondary' },
  archived: { label: 'Archived', class: 'text-bg-dark' },
}

interface Props {
  status: string
  statusMap?: Record<string, { label: string; class: string }>
}

const props = defineProps<Props>()

const statusInfo = computed(() => {
  const map = props.statusMap ?? defaultStatusMap
  return map[props.status] || { label: props.status, class: 'text-bg-secondary' }
})
</script>

<template>
  <AppBadge :label="statusInfo.label" :variant-class="statusInfo.class" />
</template>
