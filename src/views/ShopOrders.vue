<script setup lang="ts">
import { computed } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppToolbarCard from '@/components/common/AppToolbarCard.vue'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import ShopOrderDetailCard from '@/components/shopOrders/ShopOrderDetailCard.vue'
import ShopOrderListCard from '@/components/shopOrders/ShopOrderListCard.vue'
import ShopOrderCatalogBrowser from '@/components/shopOrders/ShopOrderCatalogBrowser.vue'
import type { ShopOrder } from '@/services'
import { useShopOrdersData } from '@/views/shopOrders/useShopOrdersData'
import { useShopOrderMutations } from '@/views/shopOrders/useShopOrderMutations'

const props = defineProps<{ jobId?: string }>()

const jobId = computed(() => String(props.jobId ?? ''))
const {
  catalog,
  shopCategories,
  jobName,
  jobCode,
  loading,
  err,
  orders,
  selectedId,
  selected,
  search,
  statusFilter,
  filtered,
  shopOrderRecipients,
  fmtDate,
  setSelectedId,
  clearError,
} = useShopOrdersData(jobId)
const {
  newItemDescription,
  newItemQty,
  newItemNote,
  catalogItemQtys,
  selectedCatalogItemQuantities,
  sendingEmail,
  deletingOrderId,
  addItem,
  selectCatalogItem,
  updateCatalogItemQty,
  handleSelectedItemsUpdate,
  handleDeleteSelectedItem,
  createDraft,
  handleDeleteOrder,
  submitOrder,
  placeOrder,
  receiveOrder,
  sendOrderEmail,
} = useShopOrderMutations({
  jobId,
  orders,
  selected,
  selectedId,
  shopOrderRecipients,
})

const canEditOrder = (o: ShopOrder) => o.status === 'draft'
const canSubmit = (o: ShopOrder) => o.status === 'draft' && o.items.length > 0
const canOrder = (o: ShopOrder) => o.status === 'order'
const canReceive = (o: ShopOrder) => o.status === 'order'
</script>

<template>
  
  
  <div class="app-page">
    <!-- Header -->
    <AppPageHeader eyebrow="Shop Orders" :title="jobName">
      <template #meta>
        <span v-if="jobCode">Job Number: {{ jobCode }}</span>
      </template>
      <template #actions>
        <button @click="createDraft" class="btn btn-primary"><i class="bi bi-plus me-2"></i>New Order</button>
      </template>
    </AppPageHeader>

    <!-- Error Alert -->
    <AppAlert
      v-if="err"
      variant="danger"
      title="Error:"
      :message="err"
      dismissible
      @close="clearError"
    />

    <!-- Search & Filter -->
    <AppToolbarCard class="mb-4">
      <div class="row g-3">
        <div class="col-md-6">
          <input v-model="search" type="text" class="form-control" placeholder="Search orders..." />
        </div>
        <div class="col-md-6">
          <select v-model="statusFilter" class="form-select">
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="order">Order</option>
            <option value="receive">Receive</option>
          </select>
        </div>
      </div>
    </AppToolbarCard>

    <!-- Main Content -->
    <div class="row g-4">
      <!-- Order Details -->
      <div class="col-lg-8">
        <div v-if="!selected" class="card app-section-card app-empty-state-card">
          <AppEmptyState
            class="card-body"
            icon="bi bi-hand-index-thumb"
            message="Select an order to view details"
          />
        </div>
        <div v-else>
          <ShopOrderDetailCard
            :order="selected"
            :sending-email="sendingEmail"
            :format-date="fmtDate"
            :is-editable="canEditOrder(selected)"
            :can-submit="canSubmit(selected)"
            :can-order="canOrder(selected)"
            :can-receive="canReceive(selected)"
            @update-items="handleSelectedItemsUpdate"
            @delete-item="handleDeleteSelectedItem"
            @send-email="sendOrderEmail"
            @submit="submitOrder"
            @place-order="placeOrder"
            @receive="receiveOrder"
          />

          <!-- Catalog Browser (when editing) -->
          <ShopOrderCatalogBrowser
            v-if="canEditOrder(selected)"
            :items="catalog"
            :categories="shopCategories"
            :catalog-item-qtys="catalogItemQtys"
            :selected-item-quantities="selectedCatalogItemQuantities"
            @update:catalog-item-qty="updateCatalogItemQty"
            @select-for-order="selectCatalogItem"
          >
            <template #footer>
              <div class="row g-2 mb-2">
                <div class="col-7"><input v-model="newItemDescription" type="text" class="form-control form-control-sm" placeholder="Description" /></div>
                <div class="col-2">
                  <input
                    v-model="newItemQty"
                    type="text"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    class="form-control form-control-sm"
                    placeholder="Qty"
                    @input="(e) => { newItemQty = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '') }"
                    @focus="(e) => (e.target as HTMLInputElement).select()"
                  />
                </div>
                <div class="col-3"><input v-model="newItemNote" type="text" class="form-control form-control-sm" placeholder="Note" /></div>
              </div>
              <button @click="addItem" class="btn btn-primary btn-sm"><i class="bi bi-plus me-1"></i>Add Custom Item</button>
            </template>
          </ShopOrderCatalogBrowser>

        </div>
      </div>

      <!-- Orders List -->
      <div class="col-lg-4">
        <ShopOrderListCard
          :orders="filtered"
          :loading="loading"
          :selected-id="selectedId"
          :deleting-order-id="deletingOrderId"
          :format-date="fmtDate"
          @select="setSelectedId"
          @delete="handleDeleteOrder"
        />
      </div>
    </div>
  </div>

</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;
</style>

