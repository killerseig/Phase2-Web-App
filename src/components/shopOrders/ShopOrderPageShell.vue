<script setup lang="ts">
import ShopOrderExplorerShell from '@/components/shopOrders/ShopOrderExplorerShell.vue'
import AppShell from '@/layouts/AppShell.vue'

defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  testId?: string
}>(), {
  testId: undefined,
})
</script>

<template>
  <AppShell>
    <ShopOrderExplorerShell v-bind="$attrs" :test-id="testId">
      <template #catalog>
        <slot name="catalog" />
      </template>

      <template #workspace>
        <slot name="workspace" />
      </template>
    </ShopOrderExplorerShell>

    <slot />
  </AppShell>
</template>
