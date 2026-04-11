<script setup lang="ts">
import { computed } from 'vue'
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import BaseTable from '@/components/common/BaseTable.vue'
import InlineField from '@/components/common/InlineField.vue'
import ShopOrderStatusBadge from '@/components/shopOrders/ShopOrderStatusBadge.vue'
import { getShopOrderDisplayNumber, type ShopOrder, type ShopOrderItem } from '@/services'
import {
  getShopOrderItemBackorderedQuantity,
  getShopOrderItemPendingQuantity,
  getShopOrderItemReceiptStatus,
  getShopOrderItemReceivedQuantity,
  summarizeShopOrderItems,
} from '@/utils/shopOrderItems'

defineOptions({
  name: 'ShopOrderDetailCard',
})

interface Props {
  order: ShopOrder
  sendingEmail: boolean
  formatDate: (ts: unknown) => string
  isEditable: boolean
  canManageReceipt: boolean
  canSendEmail: boolean
  requestedDeliveryDate: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  updateItems: [items: ShopOrderItem[]]
  'update:requestedDeliveryDate': [value: string]
  deleteItem: [index: number]
  sendEmail: []
}>()

type EditableField =
  | 'description'
  | 'quantity'
  | 'note'
  | 'receivedQuantity'
  | 'backorderedQuantity'

function updateItemField(
  index: number,
  field: EditableField,
  value: string | number | boolean,
) {
  const updatedItems = props.order.items.map((item, itemIndex) => {
    if (itemIndex !== index) return item
    return updateOrderItem(item, field, value)
  })

  emit('updateItems', updatedItems)
}

function updateRequestedDeliveryDate(value: string | number | boolean) {
  emit('update:requestedDeliveryDate', String(value ?? ''))
}

function deleteItem(index: number) {
  emit('deleteItem', index)
}

type Align = 'start' | 'center' | 'end'
type Column = { key: string; label: string; width?: string; align?: Align; slot?: string }

const itemColumns = computed<Column[]>(() => {
  const columns: Column[] = [
    { key: 'description', label: 'Description', slot: 'description' },
    { key: 'quantity', label: 'Qty', width: '10%', align: 'center', slot: 'quantity' },
  ]

  if (props.canManageReceipt || props.order.status === 'received') {
    columns.push(
      { key: 'receivedQuantity', label: 'Received', width: '12%', align: 'center', slot: 'receivedQuantity' },
      { key: 'backorderedQuantity', label: 'Backordered', width: '12%', align: 'center', slot: 'backorderedQuantity' },
      { key: 'pendingQuantity', label: 'Pending', width: '10%', align: 'center', slot: 'pendingQuantity' },
    )
  }

  columns.push(
    { key: 'costCode', label: 'Cost Code', width: '14%', slot: 'costCode' },
    { key: 'note', label: 'Note', slot: 'note' },
  )

  if (props.isEditable) {
    columns.push({ key: 'actions', label: 'Actions', width: '10%', align: 'center', slot: 'actions' })
  }

  return columns
})

const orderDisplayNumber = computed(() => getShopOrderDisplayNumber(props.order))
const orderSummary = computed(() => summarizeShopOrderItems(props.order.items))
const emailButtonLabel = computed(() => (
  props.order.status === 'draft'
    ? 'Submit & Email'
    : 'Re-send Email'
))

function getItemStatusLabel(item: ShopOrderItem) {
  const status = getShopOrderItemReceiptStatus(item)
  if (status === 'received') return 'Received'
  if (status === 'backordered') return 'Backordered'
  if (status === 'partial') return 'Partial'
  return 'Open'
}

function updateOrderItem(
  item: ShopOrderItem,
  field: EditableField,
  value: string | number | boolean,
): ShopOrderItem {
  if (field === 'quantity') {
    const quantity = normalizeWholeNumber(value)
    const receivedQuantity = Math.min(getShopOrderItemReceivedQuantity(item), quantity)
    const backorderedQuantity = Math.min(
      getShopOrderItemBackorderedQuantity(item),
      Math.max(0, quantity - receivedQuantity),
    )

    return cleanupReceiptFields({
      ...item,
      quantity,
      receivedQuantity,
      backorderedQuantity,
    })
  }

  if (field === 'receivedQuantity') {
    const quantity = Math.max(0, item.quantity)
    const receivedQuantity = Math.min(normalizeWholeNumber(value), quantity)
    const backorderedQuantity = Math.min(
      getShopOrderItemBackorderedQuantity(item),
      Math.max(0, quantity - receivedQuantity),
    )

    return cleanupReceiptFields({
      ...item,
      receivedQuantity,
      backorderedQuantity,
    })
  }

  if (field === 'backorderedQuantity') {
    const quantity = Math.max(0, item.quantity)
    const receivedQuantity = getShopOrderItemReceivedQuantity(item)
    const backorderedQuantity = Math.min(
      normalizeWholeNumber(value),
      Math.max(0, quantity - receivedQuantity),
    )

    return cleanupReceiptFields({
      ...item,
      backorderedQuantity,
    })
  }

  if (field === 'note') {
    const note = String(value ?? '')
    return { ...item, ...(note ? { note } : { note: undefined }) }
  }

  return { ...item, description: String(value) }
}

function cleanupReceiptFields(item: ShopOrderItem): ShopOrderItem {
  const receivedQuantity = getShopOrderItemReceivedQuantity(item)
  const backorderedQuantity = getShopOrderItemBackorderedQuantity(item)

  return {
    ...item,
    ...(receivedQuantity > 0 ? { receivedQuantity } : { receivedQuantity: undefined }),
    ...(backorderedQuantity > 0 ? { backorderedQuantity } : { backorderedQuantity: undefined }),
  }
}

function normalizeWholeNumber(value: string | number | boolean): number {
  return Math.max(0, Math.floor(Number(value) || 0))
}
</script>

<template>
  <AppSectionCard class="mb-4 order-card" body-class="order-body">
    <template #header>
      <div class="d-flex justify-content-between align-items-center gap-3 flex-wrap">
        <div>
          <h5 class="mb-1">Order #{{ orderDisplayNumber }}</h5>
          <small class="text-muted">{{ formatDate(order.orderDate) }}</small>
        </div>
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <button
            class="btn btn-success btn-sm"
            type="button"
            :disabled="sendingEmail || !canSendEmail"
            :title="emailButtonLabel"
            @click="emit('sendEmail')"
          >
            <span v-if="sendingEmail" class="spinner-border spinner-border-sm me-1" />
            <i v-else class="bi bi-envelope me-1"></i>{{ emailButtonLabel }}
          </button>
          <ShopOrderStatusBadge :status="order.status" />
        </div>
      </div>
    </template>

    <div class="row g-3 mb-3">
      <div class="col-md-4">
        <label class="form-label small text-muted mb-1">Requested Delivery Date</label>
        <InlineField
          :editing="isEditable"
          :model-value="requestedDeliveryDate"
          type="date"
          input-class="form-control form-control-sm"
          @update:model-value="updateRequestedDeliveryDate"
        >
          <div class="small">{{ requestedDeliveryDate || 'Not set' }}</div>
        </InlineField>
      </div>
      <div class="col-md-8">
        <div class="row g-2">
          <div class="col-sm-3">
            <div class="small text-muted">Ordered</div>
            <div class="fw-semibold">{{ orderSummary.orderedQuantity }}</div>
          </div>
          <div class="col-sm-3">
            <div class="small text-muted">Received</div>
            <div class="fw-semibold">{{ orderSummary.receivedQuantity }}</div>
          </div>
          <div class="col-sm-3">
            <div class="small text-muted">Backordered</div>
            <div class="fw-semibold">{{ orderSummary.backorderedQuantity }}</div>
          </div>
          <div class="col-sm-3">
            <div class="small text-muted">Pending</div>
            <div class="fw-semibold">{{ orderSummary.pendingQuantity }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="order.items.length > 0" class="mb-3 order-table">
      <h6 class="mb-2">Order Items</h6>
      <BaseTable
        :rows="order.items"
        :columns="itemColumns"
        table-class="mb-0 align-middle"
      >
        <template #description="{ row, rowIndex }">
          <InlineField
            :editing="isEditable"
            :model-value="row.description"
            placeholder="Item description"
            @update:model-value="updateItemField(rowIndex, 'description', $event)"
          >
            <div>{{ row.description }}</div>
            <div
              v-if="!isEditable"
              class="small text-muted text-uppercase mt-1"
            >
              {{ getItemStatusLabel(row) }}
            </div>
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

        <template #receivedQuantity="{ row, rowIndex }">
          <InlineField
            :editing="canManageReceipt"
            :model-value="getShopOrderItemReceivedQuantity(row)"
            type="number"
            input-class="form-control form-control-sm text-center"
            step="1"
            @update:model-value="updateItemField(rowIndex, 'receivedQuantity', $event)"
          >
            <small class="text-center">{{ getShopOrderItemReceivedQuantity(row) }}</small>
          </InlineField>
        </template>

        <template #backorderedQuantity="{ row, rowIndex }">
          <InlineField
            :editing="canManageReceipt"
            :model-value="getShopOrderItemBackorderedQuantity(row)"
            type="number"
            input-class="form-control form-control-sm text-center"
            step="1"
            @update:model-value="updateItemField(rowIndex, 'backorderedQuantity', $event)"
          >
            <small class="text-center">{{ getShopOrderItemBackorderedQuantity(row) }}</small>
          </InlineField>
        </template>

        <template #pendingQuantity="{ row }">
          <small class="text-center">{{ getShopOrderItemPendingQuantity(row) }}</small>
        </template>

        <template #costCode="{ row }">
          <small>{{ row.costCode || '--' }}</small>
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

    <div v-else class="small text-muted">
      No items added yet.
    </div>
  </AppSectionCard>
</template>
