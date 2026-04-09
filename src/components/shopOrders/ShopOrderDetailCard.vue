<script setup lang="ts">
import { computed } from 'vue'
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import BaseTable from '@/components/common/BaseTable.vue'
import InlineField from '@/components/common/InlineField.vue'
import ShopOrderStatusBadge from '@/components/shopOrders/ShopOrderStatusBadge.vue'
import type { ShopOrder, ShopOrderItem } from '@/services'

defineOptions({
  name: 'ShopOrderDetailCard',
})

interface Props {
  order: ShopOrder
  sendingEmail: boolean
  formatDate: (ts: unknown) => string
  isEditable: boolean
  canSubmit: boolean
  canOrder: boolean
  canReceive: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  updateItems: [items: ShopOrderItem[]]
  deleteItem: [index: number]
  sendEmail: []
  submit: []
  placeOrder: []
  receive: []
}>()

function updateItemField(index: number, field: 'description' | 'quantity' | 'note', value: string | number | boolean) {
  const updatedItems = props.order.items.map((item, itemIndex) => {
    if (itemIndex !== index) return item
    if (field === 'quantity') {
      return { ...item, quantity: Math.max(0, Math.floor(Number(value) || 0)) }
    }
    if (field === 'note') {
      const note = String(value ?? '')
      return { ...item, ...(note ? { note } : { note: undefined }) }
    }
    return { ...item, description: String(value) }
  })
  emit('updateItems', updatedItems)
}

function deleteItem(index: number) {
  emit('deleteItem', index)
}

type Align = 'start' | 'center' | 'end'
type Column = { key: string; label: string; width?: string; align?: Align; slot?: string }

const itemColumns: Column[] = [
  { key: 'description', label: 'Description', slot: 'description' },
  { key: 'quantity', label: 'Qty', width: '10%', align: 'center', slot: 'quantity' },
  { key: 'note', label: 'Note', slot: 'note' },
  { key: 'actions', label: 'Actions', width: '10%', align: 'center', slot: 'actions' },
]

const visibleItemColumns = computed(() =>
  props.isEditable ? itemColumns : itemColumns.filter((column) => column.key !== 'actions'))
</script>

<template>
  <AppSectionCard class="mb-4 order-card" body-class="order-body">
    <template #header>
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <h5 class="mb-1">Order {{ order.id.slice(0, 8) }}</h5>
          <small class="text-muted">{{ formatDate(order.orderDate) }}</small>
        </div>
        <div class="d-flex align-items-center gap-2">
          <button
            class="btn btn-success btn-sm"
            type="button"
            :disabled="sendingEmail"
            title="Submit and email this order"
            @click="emit('sendEmail')"
          >
            <span v-if="sendingEmail" class="spinner-border spinner-border-sm me-1" />
            <i v-else class="bi bi-envelope me-1"></i>Submit & Email
          </button>
          <ShopOrderStatusBadge :status="order.status" />
        </div>
      </div>
    </template>

      <div v-if="order.items.length > 0" class="mb-3 order-table">
        <h6 class="mb-2">Order Items</h6>
        <BaseTable
          :rows="order.items"
          :columns="visibleItemColumns"
          table-class="mb-0 align-middle"
        >
          <template #description="{ row, rowIndex }">
            <InlineField
              :editing="isEditable"
              :model-value="row.description"
              placeholder="Item description"
              @update:model-value="updateItemField(rowIndex, 'description', $event)"
            >
              <small>{{ row.description }}</small>
            </InlineField>
          </template>

          <template #quantity="{ row, rowIndex }">
            <InlineField
              :editing="isEditable"
              :model-value="row.quantity"
              type="number"
              input-class="form-control form-control-sm text-center"
              step="1"
              @update:model-value="updateItemField(rowIndex, 'quantity', $event)"
            >
              <small class="text-center">{{ row.quantity }}</small>
            </InlineField>
          </template>

          <template #note="{ row, rowIndex }">
            <InlineField
              :editing="isEditable"
              :model-value="row.note || ''"
              placeholder="Optional note"
              @update:model-value="updateItemField(rowIndex, 'note', $event)"
            >
              <small class="text-muted">{{ row.note || '--' }}</small>
            </InlineField>
          </template>

          <template #actions="{ rowIndex }">
            <button
              v-if="isEditable"
              class="btn btn-sm btn-outline-danger"
              title="Delete row"
              @click="deleteItem(rowIndex)"
            >
              <i class="bi bi-trash"></i>
            </button>
          </template>
        </BaseTable>
      </div>

      <div v-if="!isEditable" class="d-grid gap-2 mt-3">
        <button v-if="canSubmit" class="btn btn-success" @click="emit('submit')"><i class="bi bi-check-circle me-1"></i>Submit Order</button>
        <button v-if="canOrder" class="btn btn-info" @click="emit('placeOrder')"><i class="bi bi-box-seam me-1"></i>Place Order</button>
        <button v-if="canReceive" class="btn btn-success" @click="emit('receive')"><i class="bi bi-check me-1"></i>Receive</button>
      </div>
  </AppSectionCard>
</template>
