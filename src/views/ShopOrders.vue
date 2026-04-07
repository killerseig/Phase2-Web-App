<script setup lang="ts">
import { computed } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import ShopOrderEditorSection from '@/components/shopOrders/ShopOrderEditorSection.vue'
import ShopOrdersFilterToolbar from '@/components/shopOrders/ShopOrdersFilterToolbar.vue'
import ShopOrderListCard from '@/components/shopOrders/ShopOrderListCard.vue'
import { useShopOrdersData } from '@/composables/shopOrders/useShopOrdersData'
import { useShopOrderMutations } from '@/composables/shopOrders/useShopOrderMutations'

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

const statusFilterOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'order', label: 'Order' },
  { value: 'receive', label: 'Receive' },
] as const
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
    <ShopOrdersFilterToolbar
      v-model:search="search"
      v-model:status-filter="statusFilter"
      :status-options="statusFilterOptions"
    />

    <!-- Main Content -->
    <div class="row g-4">
      <!-- Order Details -->
      <div class="col-lg-8">
        <ShopOrderEditorSection
          :selected="selected"
          :sending-email="sendingEmail"
          :format-date="fmtDate"
          :catalog="catalog"
          :categories="shopCategories"
          :catalog-item-qtys="catalogItemQtys"
          :selected-item-quantities="selectedCatalogItemQuantities"
          v-model:new-item-description="newItemDescription"
          v-model:new-item-qty="newItemQty"
          v-model:new-item-note="newItemNote"
          @update-items="handleSelectedItemsUpdate"
          @delete-item="handleDeleteSelectedItem"
          @send-email="sendOrderEmail"
          @submit="submitOrder"
          @place-order="placeOrder"
          @receive="receiveOrder"
          @update:catalog-item-qty="updateCatalogItemQty"
          @select-for-order="selectCatalogItem"
          @add-item="addItem"
        />
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


