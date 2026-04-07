<script setup lang="ts">
import { computed } from 'vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import BaseInputField from '@/components/common/BaseInputField.vue'
import ShopOrderCatalogBrowser from '@/components/shopOrders/ShopOrderCatalogBrowser.vue'
import ShopOrderDetailCard from '@/components/shopOrders/ShopOrderDetailCard.vue'
import type { ShopCatalogItem, ShopOrder } from '@/services'
import type { ShopCategory } from '@/stores/shopCategories'
import type { CatalogItemQuantityUpdate, CatalogOrderSelection } from '@/types/shopOrders'

const props = defineProps<{
  selected?: ShopOrder | null
  sendingEmail: boolean
  formatDate: (ts: unknown) => string
  catalog: ShopCatalogItem[]
  categories: ShopCategory[]
  catalogItemQtys: Record<string, number>
  selectedItemQuantities: Record<string, number>
  newItemDescription: string
  newItemQty: string
  newItemNote: string
}>()

const emit = defineEmits<{
  'update-items': [items: ShopOrder['items']]
  'delete-item': [index: number]
  'send-email': []
  submit: []
  'place-order': []
  receive: []
  'update:catalog-item-qty': [payload: CatalogItemQuantityUpdate]
  'select-for-order': [item: CatalogOrderSelection]
  'update:newItemDescription': [value: string]
  'update:newItemQty': [value: string]
  'update:newItemNote': [value: string]
  'add-item': []
}>()

const canEditOrder = computed(() => props.selected?.status === 'draft')
const canSubmit = computed(() => props.selected?.status === 'draft' && (props.selected.items?.length ?? 0) > 0)
const canOrder = computed(() => props.selected?.status === 'order')
const canReceive = computed(() => props.selected?.status === 'order')

function updateNewItemQty(value: string) {
  emit('update:newItemQty', value.replace(/[^0-9]/g, ''))
}

function selectInputText(event: FocusEvent) {
  ;(event.target as HTMLInputElement | null)?.select()
}
</script>

<template>
  <AppSectionCard v-if="!selected" class="app-empty-state-card">
    <AppEmptyState
      icon="bi bi-hand-index-thumb"
      message="Select an order to view details"
    />
  </AppSectionCard>

  <div v-else>
    <ShopOrderDetailCard
      :order="selected"
      :sending-email="sendingEmail"
      :format-date="formatDate"
      :is-editable="canEditOrder"
      :can-submit="canSubmit"
      :can-order="canOrder"
      :can-receive="canReceive"
      @update-items="emit('update-items', $event)"
      @delete-item="emit('delete-item', $event)"
      @send-email="emit('send-email')"
      @submit="emit('submit')"
      @place-order="emit('place-order')"
      @receive="emit('receive')"
    />

    <ShopOrderCatalogBrowser
      v-if="canEditOrder"
      :items="catalog"
      :categories="categories"
      :catalog-item-qtys="catalogItemQtys"
      :selected-item-quantities="selectedItemQuantities"
      @update:catalog-item-qty="emit('update:catalog-item-qty', $event)"
      @select-for-order="emit('select-for-order', $event)"
    >
      <template #footer>
        <div class="row g-2 mb-2">
          <div class="col-7">
            <BaseInputField
              :model-value="newItemDescription"
              placeholder="Description"
              input-class="form-control form-control-sm"
              wrapper-class="mb-0"
              @update:model-value="emit('update:newItemDescription', $event)"
            />
          </div>
          <div class="col-2">
            <BaseInputField
              :model-value="newItemQty"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              placeholder="Qty"
              input-class="form-control form-control-sm"
              wrapper-class="mb-0"
              @update:model-value="updateNewItemQty"
              @focus="selectInputText"
            />
          </div>
          <div class="col-3">
            <BaseInputField
              :model-value="newItemNote"
              placeholder="Note"
              input-class="form-control form-control-sm"
              wrapper-class="mb-0"
              @update:model-value="emit('update:newItemNote', $event)"
            />
          </div>
        </div>
        <button class="btn btn-primary btn-sm" @click="emit('add-item')">
          <i class="bi bi-plus me-1"></i>Add Custom Item
        </button>
      </template>
    </ShopOrderCatalogBrowser>
  </div>
</template>
