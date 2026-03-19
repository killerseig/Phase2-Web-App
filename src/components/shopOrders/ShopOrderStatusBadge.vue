<script setup lang="ts">
import StatusBadge from '@/components/common/StatusBadge.vue'
import type { ShopOrderStatus } from '@/services'

defineOptions({
  name: 'ShopOrderStatusBadge',
})

const shopOrderStatusMap: Record<ShopOrderStatus, { label: string; class: string }> = {
  draft: { label: 'Draft', class: 'text-bg-secondary' },
  order: { label: 'Submitted', class: 'text-bg-primary' },
  receive: { label: 'Received', class: 'text-bg-success' },
}

defineProps<{
  status: ShopOrderStatus
}>()
</script>

<template>
  <StatusBadge :status="status" :status-map="shopOrderStatusMap" />
</template>
