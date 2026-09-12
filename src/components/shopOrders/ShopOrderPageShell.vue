<script setup lang="ts">
import ShopOrderExplorerShell from '@/components/shopOrders/ShopOrderExplorerShell.vue'
import AppShell from '@/layouts/AppShell.vue'

defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  confirmationOpen?: boolean
  testId?: string
}>(), {
  confirmationOpen: false,
  testId: undefined,
})
</script>

<template>
  <AppShell>
    <ShopOrderExplorerShell
      v-bind="$attrs"
      :test-id="testId"
      :confirmation-open="confirmationOpen"
    >
      <template #catalog="catalog">
        <slot name="catalog" v-bind="catalog" />
      </template>

      <template #workspace>
        <slot name="workspace" />
      </template>
    </ShopOrderExplorerShell>

    <slot />
  </AppShell>
</template>
