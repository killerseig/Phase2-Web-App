<script setup lang="ts">
import AppMobilePanelTabs from '@/components/common/AppMobilePanelTabs.vue'

type MobileCatalogPanel = 'catalog' | 'inspector'

defineProps<{
  activePanel: MobileCatalogPanel
}>()

const emit = defineEmits<{
  show: [panel: MobileCatalogPanel]
}>()

const panels = [
  { key: 'catalog', label: 'Catalog' },
  { key: 'inspector', label: 'Inspector' },
]

function showPanel(panel: string) {
  if (panel === 'catalog' || panel === 'inspector') emit('show', panel)
}
</script>

<template>
  <AppMobilePanelTabs
    class="shop-catalog-mobile-nav"
    label="Shop catalog panels"
    :active-panel="activePanel"
    :panels="panels"
    @show="showPanel"
  />
</template>

<style scoped>
@media (max-width: 1180px) {
  .shop-catalog-mobile-nav.app-mobile-panel-tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
