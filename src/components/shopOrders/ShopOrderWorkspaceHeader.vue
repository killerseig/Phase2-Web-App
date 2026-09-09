<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'
import AppLoadingButton from '@/components/common/AppLoadingButton.vue'
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
import type { JobRecord } from '@/types/domain'
import { formatShopOrderCurrency } from '@/utils/shopOrders'

defineProps<{
  canCreateOrder: boolean
  canSubmitOrder: boolean
  createOrderLoading: boolean
  itemActionLoading: boolean
  job: JobRecord | null
  orderEstimatedTotal: number | null
}>()

const emit = defineEmits<{
  createOrder: []
  submitOrder: []
}>()

function getWorkspaceTitle(job: JobRecord | null) {
  return job ? `${job.code || 'No Job #'} - ${job.name}` : 'Current Job'
}
</script>

<template>
  <AppPaneHeader
    class="shop-order-workspace-header"
    eyebrow="Order Workspace"
    :title="getWorkspaceTitle(job)"
    title-tag="h2"
  >
    <template #actions>
      <div class="shop-order-workspace-header__actions">
        <AppLoadingButton
          label="New Order"
          loading-label="Creating..."
          variant="primary"
          data-testid="shoporder-new-order"
          :loading="createOrderLoading"
          :disabled="!canCreateOrder"
          @click="emit('createOrder')"
        />
        <div
          v-if="canSubmitOrder"
          class="shop-order-workspace-header__submit"
        >
          <div
            class="shop-order-workspace-header__total"
            data-testid="shoporder-submit-total"
          >
            <span>Estimated Total</span>
            <strong>{{ formatShopOrderCurrency(orderEstimatedTotal, 'No priced items') }}</strong>
          </div>
          <AppButton
            data-testid="shoporder-submit"
            :disabled="itemActionLoading || createOrderLoading"
            @click="emit('submitOrder')"
          >
            Submit Order
          </AppButton>
        </div>
      </div>
    </template>
  </AppPaneHeader>
</template>

<style scoped>
.shop-order-workspace-header {
  min-width: 0;
  padding-bottom: 0.32rem;
  border-bottom: 1px solid var(--shop-line-soft);
}

.shop-order-workspace-header :deep(.app-pane-header__copy),
.shop-order-workspace-header :deep(.app-pane-header__title) {
  min-width: 0;
}

.shop-order-workspace-header :deep(.app-pane-header__title) {
  letter-spacing: -0.015em;
  overflow: hidden;
  text-overflow: ellipsis;
}

.shop-order-workspace-header__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: flex-start;
  gap: var(--field-gap);
}

.shop-order-workspace-header__submit {
  display: grid;
  justify-items: stretch;
  gap: 0.28rem;
  min-width: 9.5rem;
}

.shop-order-workspace-header__total {
  display: grid;
  gap: 0.08rem;
  min-height: 2.2rem;
  padding: 0.38rem 0.7rem 0.42rem;
  border: 1px solid var(--border);
  border-radius: var(--shop-radius-md);
  background: var(--panel-background);
  color: var(--text);
  text-align: right;
  box-shadow: none;
}

.shop-order-workspace-header__total span {
  color: var(--text-muted);
  font-size: var(--font-size-eyebrow);
  font-weight: 500;
  letter-spacing: var(--letter-spacing-eyebrow);
  line-height: 1.2;
  text-transform: uppercase;
}

.shop-order-workspace-header__total strong {
  color: var(--text);
  font-size: 1.05rem;
  font-weight: var(--font-weight-heading);
  line-height: 1.05;
}

@media (max-width: 820px) {
  .shop-order-workspace-header__actions {
    justify-content: flex-start;
  }

  .shop-order-workspace-header__submit {
    width: min(100%, 13rem);
  }

  .shop-order-workspace-header__total {
    text-align: left;
  }
}
</style>
