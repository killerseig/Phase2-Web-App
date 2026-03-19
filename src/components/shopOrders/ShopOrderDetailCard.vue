<script setup lang="ts">
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
  sendEmail: []
  submit: []
  placeOrder: []
  receive: []
}>()

function updateItemField(index: number, field: 'description' | 'quantity' | 'note', value: string | number) {
  const updatedItems = props.order.items.map((item, itemIndex) => {
    if (itemIndex !== index) return item
    if (field === 'quantity') {
      return { ...item, quantity: Math.max(0, Math.floor(Number(value) || 0)) }
    }
    if (field === 'note') {
      const note = String(value || '').trim()
      return { ...item, ...(note ? { note } : { note: undefined }) }
    }
    return { ...item, description: String(value) }
  })
  emit('updateItems', updatedItems)
}

function deleteItem(index: number) {
  emit('updateItems', props.order.items.filter((_, itemIndex) => itemIndex !== index))
}
</script>

<template>
  <div class="card mb-4 order-card app-section-card">
    <div class="card-header panel-header">
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
    </div>
    <div class="card-body order-body">
      <div v-if="order.items.length > 0" class="table-responsive mb-3 order-table">
        <h6 class="mb-2">Order Items</h6>
        <table class="table table-sm table-striped table-hover mb-0 align-middle">
          <thead>
            <tr>
              <th class="small fw-semibold">Description</th>
              <th class="small fw-semibold text-center">Qty</th>
              <th class="small fw-semibold">Note</th>
              <th v-if="isEditable" class="small fw-semibold text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, idx) in order.items" :key="item.catalogItemId ?? `${item.description}-${idx}`">
              <td class="p-2">
                <template v-if="isEditable">
                  <input
                    type="text"
                    class="form-control form-control-sm"
                    :value="item.description"
                    placeholder="Item description"
                    @input="updateItemField(idx, 'description', ($event.target as HTMLInputElement).value)"
                  />
                </template>
                <template v-else>
                  <small>{{ item.description }}</small>
                </template>
              </td>
              <td class="p-2 text-center">
                <template v-if="isEditable">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    class="form-control form-control-sm text-center"
                    :value="item.quantity"
                    @input="updateItemField(idx, 'quantity', ($event.target as HTMLInputElement).value)"
                  />
                </template>
                <template v-else>
                  <small class="text-center">{{ item.quantity }}</small>
                </template>
              </td>
              <td class="p-2">
                <template v-if="isEditable">
                  <input
                    type="text"
                    class="form-control form-control-sm"
                    :value="item.note || ''"
                    placeholder="Optional note"
                    @input="updateItemField(idx, 'note', ($event.target as HTMLInputElement).value)"
                  />
                </template>
                <template v-else>
                  <small class="text-muted">{{ item.note || '--' }}</small>
                </template>
              </td>
              <td v-if="isEditable" class="p-2 text-center">
                <button
                  class="btn btn-sm btn-outline-danger"
                  title="Delete row"
                  @click="deleteItem(idx)"
                >
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!isEditable" class="d-grid gap-2 mt-3">
        <button v-if="canSubmit" class="btn btn-success" @click="emit('submit')"><i class="bi bi-check-circle me-1"></i>Submit Order</button>
        <button v-if="canOrder" class="btn btn-info" @click="emit('placeOrder')"><i class="bi bi-box-seam me-1"></i>Place Order</button>
        <button v-if="canReceive" class="btn btn-success" @click="emit('receive')"><i class="bi bi-check me-1"></i>Receive</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.order-card .card-header {
  border-bottom: 1px solid $border-color;
  background: $surface-2;
}

.order-card .order-body {
  background: $surface;
}

.order-table {
  border: 1px solid $border-color;
  border-radius: $border-radius;
  background: $surface;
}
</style>
