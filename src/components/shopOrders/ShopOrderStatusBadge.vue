<script setup lang="ts">
import StatusBadge from '@/components/common/StatusBadge.vue'
import type { ShopOrderStatus } from '@/services'

defineOptions({
  name: 'ShopOrderStatusBadge',
})

const shopOrderStatusMap: Record<ShopOrderStatus, { label: string; class: string }> = {
  draft: { label: 'Draft', class: 'text-bg-secondary' },
  submitted: { label: 'Submitted', class: 'text-bg-primary' },
  partial: { label: 'Partial', class: 'text-bg-warning text-dark' },
  backordered: { label: 'Backordered', class: 'text-bg-danger' },
  received: { label: 'Received', class: 'text-bg-success' },
}

defineProps<{
  status: ShopOrderStatus
}>()
</script>

<template>
  <StatusBadge :status="status" :status-map="shopOrderStatusMap" />
</template>
