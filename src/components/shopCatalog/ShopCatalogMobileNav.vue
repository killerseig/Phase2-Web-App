<script setup lang="ts">
import Button from 'primevue/button'

type MobileCatalogPanel = 'catalog' | 'inspector'

defineProps<{
  activePanel: MobileCatalogPanel
}>()

const emit = defineEmits<{
  show: [panel: MobileCatalogPanel]
}>()
</script>

<template>
  <div class="shop-catalog-mobile-nav" role="tablist" aria-label="Shop catalog panels">
    <Button
      unstyled
      type="button"
      class="shop-catalog-mobile-nav__toggle"
      :class="{ 'shop-catalog-mobile-nav__toggle--active': activePanel === 'catalog' }"
      label="Catalog"
      role="tab"
      :aria-selected="activePanel === 'catalog'"
      @click="emit('show', 'catalog')"
    />
    <Button
      unstyled
      type="button"
      class="shop-catalog-mobile-nav__toggle"
      :class="{ 'shop-catalog-mobile-nav__toggle--active': activePanel === 'inspector' }"
      label="Inspector"
      role="tab"
      :aria-selected="activePanel === 'inspector'"
      @click="emit('show', 'inspector')"
    />
  </div>
</template>

<style scoped>
.shop-catalog-mobile-nav {
  display: none;
  gap: 0.7rem;
}

.shop-catalog-mobile-nav__toggle {
  display: inline-flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  min-height: 2.45rem;
  padding: 0 1rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-muted);
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease;
}

.shop-catalog-mobile-nav__toggle:hover {
  border-color: rgba(88, 186, 233, 0.24);
  background: rgba(33, 73, 97, 0.22);
  color: var(--text);
}

.shop-catalog-mobile-nav__toggle--active {
  border-color: rgba(88, 186, 233, 0.26);
  background: rgba(33, 73, 97, 0.32);
  color: var(--text);
}

@media (max-width: 1180px) {
  .shop-catalog-mobile-nav {
    display: flex;
  }
}
</style>
