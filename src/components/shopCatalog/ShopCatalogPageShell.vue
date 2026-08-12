<script setup lang="ts">
import ShopCatalogExplorerShell from '@/components/shopCatalog/ShopCatalogExplorerShell.vue'
import AppShell from '@/layouts/AppShell.vue'

type ShopCatalogPanel = 'catalog' | 'inspector'

defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  activePanel: ShopCatalogPanel
  testId?: string
}>(), {
  testId: undefined,
})
</script>

<template>
  <AppShell>
    <ShopCatalogExplorerShell
      v-bind="$attrs"
      :active-panel="activePanel"
      :test-id="testId"
    >
      <template #mobile-nav>
        <slot name="mobile-nav" />
      </template>

      <template #catalog>
        <slot name="catalog" />
      </template>

      <template #inspector>
        <slot name="inspector" />
      </template>

      <template #context-menu>
        <slot name="context-menu" />
      </template>
    </ShopCatalogExplorerShell>

    <slot />
  </AppShell>
</template>
