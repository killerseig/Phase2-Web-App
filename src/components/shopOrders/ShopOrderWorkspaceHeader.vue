<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
import type { JobRecord } from '@/types/domain'
import { formatShopOrderCurrency } from '@/utils/shopOrders'

defineProps<{
  canSubmitOrder: boolean
  createOrderLoading: boolean
  itemActionLoading: boolean
  job: JobRecord | null
  orderEstimatedTotal: number | null
}>()

const emit = defineEmits<{
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
  flex-direction: column;
  align-items: stretch;
  min-width: 0;
  padding-bottom: 0.32rem;
  border-bottom: 1px solid var(--shop-line-soft);
}

.shop-order-workspace-header :deep(.app-pane-header__copy),
.shop-order-workspace-header :deep(.app-pane-header__title),
.shop-order-workspace-header :deep(.app-pane-header__actions) {
  min-width: 0;
  width: 100%;
}

.shop-order-workspace-header :deep(.app-pane-header__title) {
  letter-spacing: -0.015em;
}

.shop-order-workspace-header__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: var(--field-gap);
  width: 100%;
}

.shop-order-workspace-header__submit {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  min-width: 0;
}

.shop-order-workspace-header__total {
  display: grid;
  gap: 0.08rem;
  padding: 0;
  color: var(--text);
  text-align: right;
  box-shadow: none;
}

.shop-order-workspace-header__total span {
  color: var(--text-muted);
  font-size: var(--font-size-help);
  font-weight: 500;
  line-height: 1.2;
}

.shop-order-workspace-header__total strong {
  color: var(--text);
  font-size: 1.05rem;
  font-weight: var(--font-weight-heading);
  line-height: 1.05;
}

@container shop-order-workspace (max-width: 24rem) {
  .shop-order-workspace-header__submit {
    width: 100%;
    justify-content: space-between;
  }

  .shop-order-workspace-header__total {
    text-align: left;
  }
}
</style>
