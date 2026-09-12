<script setup lang="ts">
export interface ShopCatalogContextMenuAction {
  key: string
  label: string
  danger?: boolean
  disabled?: boolean
  run: () => void
}

defineProps<{
  visible: boolean
  x: number
  y: number
  actions: readonly ShopCatalogContextMenuAction[]
}>()
</script>

<template>
  <div
    v-if="visible"
    class="shop-catalog-context-menu"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @pointerdown.stop
    @contextmenu.prevent
  >
    <button
      v-for="action in actions"
      :key="action.key"
      type="button"
      class="shop-catalog-context-menu__item"
      :class="{ 'shop-catalog-context-menu__item--danger': action.danger }"
      :disabled="action.disabled"
      @click="action.run()"
    >
      {{ action.label }}
    </button>
  </div>
</template>

<style scoped>
.shop-catalog-context-menu {
  position: fixed;
  z-index: 30;
  display: grid;
  gap: 0.2rem;
  min-width: 13rem;
  padding: 0.35rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--panel-background);
  box-shadow: none;
}

.shop-catalog-context-menu__item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 2.25rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.shop-catalog-context-menu__item:hover:not(:disabled) {
  background: var(--field-hover);
}

.shop-catalog-context-menu__item:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: -1px;
}

.shop-catalog-context-menu__item:disabled {
  color: var(--text-soft);
  opacity: 0.55;
  cursor: default;
}

.shop-catalog-context-menu__item--danger {
  color: var(--danger);
}

.shop-catalog-context-menu__item--danger:hover:not(:disabled) {
  background: var(--danger-surface);
}
</style>
