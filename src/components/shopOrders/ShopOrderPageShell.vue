<script setup lang="ts">
import ShopOrderExplorerShell from '@/components/shopOrders/ShopOrderExplorerShell.vue'
import AppPageLayout from '@/components/common/AppPageLayout.vue'
import AppShell from '@/layouts/AppShell.vue'

defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    confirmationOpen?: boolean
    testId?: string
    description?: string
  }>(),
  {
    confirmationOpen: false,
    testId: undefined,
  },
)
</script>

<template>
  <AppShell>
    <AppPageLayout
      title="Shop Orders"
      eyebrow="Field Workspace"
      :description="description || 'Choose catalog items, build an order, and schedule delivery.'"
      fill
    >
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
    </AppPageLayout>

    <slot />
  </AppShell>
</template>
