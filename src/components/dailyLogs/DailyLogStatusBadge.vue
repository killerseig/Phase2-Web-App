<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/common/StatusBadge.vue'

defineOptions({
  name: 'DailyLogStatusBadge',
})

interface Props {
  status: string
  autoSaved?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoSaved: false,
})

const normalizedStatus = computed(() => props.status.toLowerCase())
const statusMap = computed<Record<string, { label: string; class: string }>>(() => ({
  draft: {
    label: props.autoSaved ? 'Draft (auto-saved)' : 'Draft',
    class: 'text-bg-warning',
  },
  submitted: {
    label: 'Submitted',
    class: 'text-bg-success',
  },
}))
</script>

<template>
  <StatusBadge :status="normalizedStatus" :status-map="statusMap" />
</template>
