<script setup lang="ts">
import { computed } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'
import type { ShopOrderCatalogBrowserNode } from '@/features/shopOrders/catalogBrowserHelpers'

const props = withDefaults(defineProps<{
  active: boolean
  disabled?: boolean
  expanded?: boolean
  node: ShopOrderCatalogBrowserNode
  quantity?: string
}>(), {
  disabled: false,
  expanded: false,
  quantity: '1',
})

const emit = defineEmits<{
  add: []
  contextMenu: [event: MouseEvent]
  select: []
  toggle: []
  updateQuantity: [value: string]
}>()

const isItem = computed(() => props.node.kind === 'item')
const hasChildren = computed(() => {
  if (props.node.kind === 'item') return false
  return props.node.hasChildren
})
const secondaryLabel = computed(() => {
  if (props.node.kind === 'item') return ''
  return props.node.secondary ?? ''
})
const itemPriceLabel = computed(() => {
  if (props.node.kind !== 'item') return ''
  return props.node.priceLabel
})
const rowTestId = computed(() => {
  if (props.node.kind === 'root') return 'shoporder-root-row'
  if (props.node.kind === 'category') return `shoporder-category-${props.node.id}`
  return `shoporder-item-${props.node.id}`
})
const toggleTestId = computed(() => (props.node.kind === 'root' ? 'shoporder-root-toggle' : undefined))

</script>

<template>
  <div
    class="shop-orders-tree-node"
    :class="{
      'shop-orders-tree-node--root': props.node.kind === 'root',
      'shop-orders-tree-node--item': isItem,
      'shop-orders-tree-node--active': props.active,
    }"
    :data-testid="rowTestId"
    role="button"
    tabindex="0"
    @click="emit('select')"
    @keydown.enter.prevent="emit('select')"
    @contextmenu="emit('contextMenu', $event)"
  >
    <span class="shop-orders-tree-node__indent" :style="{ '--node-depth': props.node.depth }"></span>
    <button
      v-if="hasChildren"
      type="button"
      class="shop-orders-tree-node__twist"
      :class="{ 'shop-orders-tree-node__twist--open': props.expanded }"
      :data-testid="toggleTestId"
      :data-state="props.expanded ? 'expanded' : 'collapsed'"
      :aria-label="`${props.expanded ? 'Collapse' : 'Expand'} ${props.node.label}`"
      :aria-expanded="props.expanded"
      @click.stop="emit('toggle')"
      @keydown.enter.prevent.stop="emit('toggle')"
      @keydown.space.prevent.stop="emit('toggle')"
    >
      <span class="shop-orders-chevron"></span>
    </button>
    <span
      v-else
      class="shop-orders-tree-node__twist shop-orders-tree-node__twist--placeholder"
    ></span>
    <span
      :class="[
        'shop-orders-node-icon',
        isItem ? 'shop-orders-node-icon--item' : 'shop-orders-node-icon--folder',
      ]"
    ></span>
    <span class="shop-orders-tree-node__label">{{ props.node.label }}</span>
    <span
      v-if="itemPriceLabel"
      class="shop-orders-tree-node__price"
    >
      {{ itemPriceLabel }}
    </span>
    <span
      v-if="secondaryLabel"
      class="shop-orders-tree-node__meta"
    >
      {{ secondaryLabel }}
    </span>

    <div
      v-if="props.node.kind === 'item'"
      class="shop-orders-tree-node__actions"
      @click.stop
    >
      <AppTextInput
        class="shop-orders-tree-node__quantity"
        :model-value="props.quantity"
        :data-testid="`shoporder-quantity-${props.node.id}`"
        type="number"
        min="1"
        step="1"
        inputmode="numeric"
        :disabled="props.disabled"
        aria-label="Item quantity"
        @update:model-value="emit('updateQuantity', $event)"
      />
      <AppButton
        class="shop-orders-tree-node__add"
        variant="primary"
        :data-testid="`shoporder-add-${props.node.id}`"
        :disabled="props.disabled"
        aria-label="Add item to order"
        @click.stop="emit('add')"
      >
        +
      </AppButton>
    </div>
  </div>
</template>

<style scoped>
.shop-orders-tree-node {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
  min-width: 0;
  min-height: 2.25rem;
  padding: 0 0.5rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.shop-orders-tree-node:hover {
  border-color: var(--border);
  background: var(--field-hover);
}

.shop-orders-tree-node--active,
.shop-orders-tree-node--active:hover {
  border-color: var(--border-strong);
  background: var(--bg-accent);
}

.shop-orders-tree-node:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: -1px;
}

.shop-orders-tree-node__indent {
  flex: 0 0 auto;
  width: calc(var(--node-depth, 0) * 1rem);
}

.shop-orders-tree-node__twist {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-soft);
}

.shop-orders-tree-node__twist--placeholder {
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.shop-orders-chevron {
  width: 0.45rem;
  height: 0.45rem;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(-45deg);
  transition: transform 0.18s ease;
}

.shop-orders-tree-node__twist--open .shop-orders-chevron {
  transform: rotate(45deg);
}

.shop-orders-node-icon {
  position: relative;
  display: inline-flex;
  width: 0.95rem;
  height: 0.8rem;
  flex: 0 0 auto;
}

.shop-orders-node-icon--folder::before,
.shop-orders-node-icon--folder::after,
.shop-orders-node-icon--item::before {
  content: "";
  position: absolute;
  box-sizing: border-box;
}

.shop-orders-node-icon--folder::before {
  left: 0;
  top: 0.18rem;
  width: 0.95rem;
  height: 0.58rem;
  border: 1px solid rgba(145, 220, 255, 0.58);
  border-radius: 0.18rem;
  background: rgba(50, 125, 153, 0.18);
}

.shop-orders-node-icon--folder::after {
  left: 0.08rem;
  top: 0;
  width: 0.38rem;
  height: 0.24rem;
  border: 1px solid rgba(145, 220, 255, 0.58);
  border-bottom: none;
  border-radius: 0.18rem 0.18rem 0 0;
  background: rgba(50, 125, 153, 0.18);
}

.shop-orders-node-icon--item::before {
  left: 0.08rem;
  top: 0.02rem;
  width: 0.72rem;
  height: 0.76rem;
  border: 1px solid rgba(193, 208, 225, 0.36);
  border-radius: 0.12rem;
  background: var(--field);
  box-shadow: none;
}

.shop-orders-tree-node__label {
  flex: 1 1 auto;
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
  line-height: 1.3;
  font-size: 0.92rem;
}

.shop-orders-tree-node--root .shop-orders-tree-node__label {
  font-weight: var(--font-weight-heading);
}

.shop-orders-tree-node__meta {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-soft);
  font-size: 0.78rem;
  white-space: nowrap;
}

.shop-orders-tree-node__price {
  flex: 0 0 auto;
  color: var(--text);
  font-size: 0.76rem;
  font-weight: var(--font-weight-heading);
  white-space: nowrap;
}

.shop-orders-tree-node--item {
  min-height: calc(var(--shop-number-control-height, 2rem) + 2px);
}

.shop-orders-tree-node__actions {
  --app-text-input-min-height: var(--shop-control-height);
  --app-text-input-padding-x: 0.65rem;
  --app-text-input-border: var(--shop-line);
  --app-text-input-radius: var(--shop-radius-md);
  --app-text-input-background: var(--shop-field);
  --app-text-input-box-shadow: none;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
  flex: 0 0 auto;
}

.shop-orders-tree-node__quantity {
  width: 3.5rem;
}

.shop-orders-tree-node__add {
  min-width: 2.25rem;
  min-height: var(--shop-number-control-height, 2rem);
  padding: 0;
  font-size: 1.1rem;
  line-height: 1;
}

@media (max-width: 1180px) {
  .shop-orders-tree-node {
    height: auto;
    padding-top: 0;
    padding-bottom: 0;
  }
}

@media (max-width: 560px) {
  .shop-orders-tree-node__meta {
    flex: 0 0 auto;
    font-size: var(--font-size-help);
  }

  .shop-orders-tree-node__indent {
    width: calc(min(var(--node-depth, 0), 3) * 0.5rem);
  }

  .shop-orders-tree-node--item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    column-gap: var(--space-2);
    row-gap: 0;
    padding: var(--space-1) var(--space-2);
  }

  .shop-orders-tree-node--item .shop-orders-tree-node__indent,
  .shop-orders-tree-node--item .shop-orders-tree-node__twist--placeholder {
    display: none;
  }

  .shop-orders-tree-node--item .shop-orders-tree-node__label {
    grid-column: 2;
    grid-row: 1;
    align-self: end;
  }

  .shop-orders-tree-node--item .shop-orders-node-icon {
    grid-row: 1 / 3;
  }

  .shop-orders-tree-node__price {
    grid-column: 2;
    grid-row: 2;
    align-self: start;
    font-size: var(--font-size-label);
  }

  .shop-orders-tree-node__actions {
    grid-column: 3;
    grid-row: 1 / 3;
  }
}

@media (pointer: coarse) {
  .shop-orders-tree-node__twist {
    width: 2.75rem;
    height: 2.75rem;
  }

  .shop-orders-tree-node__twist--placeholder {
    width: 1rem;
    height: 0;
  }
}
</style>
