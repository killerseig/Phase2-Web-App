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
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0)),
    rgba(28, 36, 46, 0.98);
  box-shadow: 0 18px 34px rgba(4, 9, 15, 0.38);
  backdrop-filter: blur(10px);
}

.shop-catalog-context-menu__item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 2.2rem;
  padding: 0 0.7rem;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: var(--text);
  text-align: left;
}

.shop-catalog-context-menu__item:hover:not(:disabled) {
  border-color: rgba(88, 186, 233, 0.18);
  background: rgba(34, 79, 104, 0.22);
}

.shop-catalog-context-menu__item:disabled {
  color: var(--text-soft);
  opacity: 0.55;
}

.shop-catalog-context-menu__item--danger {
  color: var(--danger);
}

.shop-catalog-context-menu__item--danger:hover:not(:disabled) {
  border-color: rgba(255, 125, 107, 0.18);
  background: rgba(108, 48, 44, 0.2);
}
</style>
