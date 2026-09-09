<script setup lang="ts">
import AppDateInput from '@/components/common/AppDateInput.vue'
import AppReadonlyField from '@/components/common/AppReadonlyField.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'

defineProps<{
  canEdit: boolean
  comments: string
  deliveryDate: string
  minDeliveryDate: string
  readonlyComments?: string | null
  readonlyDeliveryDate?: string | null
}>()

const emit = defineEmits<{
  applyThursdayDelivery: []
  'update:comments': [value: string]
  'update:deliveryDate': [value: string]
}>()

function isThursdayDeliveryValue(value: string | null | undefined) {
  if (!value) return false
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return false
  return new Date(year, month - 1, day).getDay() === 4
}
</script>

<template>
  <div class="shop-order-meta-form">
    <label class="shop-order-meta-form__field shop-order-meta-form__field--delivery">
      <span>Delivery Date</span>
      <AppDateInput
        v-if="canEdit"
        :model-value="deliveryDate"
        data-testid="shoporder-delivery-date"
        :min="minDeliveryDate"
        :disabled="!canEdit"
        @update:model-value="emit('update:deliveryDate', $event)"
      />
      <AppReadonlyField
        v-else
        class="shop-order-meta-form__readonly"
        data-testid="shoporder-delivery-date-readonly"
      >
        {{ readonlyDeliveryDate || 'No delivery date' }}
      </AppReadonlyField>
    </label>

    <div class="shop-order-meta-form__field shop-order-meta-form__field--shortcut">
      <span>Shortcut</span>
      <button
        v-if="canEdit"
        type="button"
        class="shop-order-meta-form__shortcut-button"
        data-testid="shoporder-shortcut"
        :disabled="!canEdit"
        @click="emit('applyThursdayDelivery')"
      >
        Thursday Delivery
      </button>
      <AppReadonlyField
        v-else
        class="shop-order-meta-form__readonly"
        data-testid="shoporder-shortcut-readonly"
      >
        {{ isThursdayDeliveryValue(readonlyDeliveryDate) ? 'Thursday Delivery' : '-' }}
      </AppReadonlyField>
    </div>

    <label class="shop-order-meta-form__field shop-order-meta-form__field--comments">
      <span>Comments</span>
      <AppTextInput
        v-if="canEdit"
        :model-value="comments"
        data-testid="shoporder-comments"
        type="text"
        :disabled="!canEdit"
        placeholder="Add delivery notes or special instructions."
        @update:model-value="emit('update:comments', $event)"
      />
      <AppReadonlyField
        v-else
        class="shop-order-meta-form__readonly shop-order-meta-form__readonly--multiline"
        data-testid="shoporder-comments-readonly"
        multiline
      >
        {{ readonlyComments || 'No comments' }}
      </AppReadonlyField>
    </label>
  </div>
</template>

<style scoped>
.shop-order-meta-form {
  display: grid;
  grid-template-columns: minmax(9rem, 10.5rem) minmax(9rem, 10.5rem) minmax(12rem, 1fr);
  gap: var(--field-gap);
  align-items: center;
}

.shop-order-meta-form__field {
  --app-text-input-min-height: var(--shop-control-height);
  --app-text-input-padding-x: 0.8rem;
  --app-text-input-border: var(--shop-line);
  --app-text-input-radius: var(--shop-radius-md);
  --app-text-input-background: var(--shop-field);
  --app-text-input-box-shadow: none;
  --app-readonly-field-min-height: var(--shop-control-height);
  --app-readonly-field-padding-x: 0.8rem;
  --app-readonly-field-border: var(--shop-line-soft);
  --app-readonly-field-radius: var(--shop-radius-md);
  --app-readonly-field-background: rgba(255, 255, 255, 0.02);
  --app-readonly-field-color: var(--text);
  display: grid;
  gap: var(--field-gap);
  color: var(--text-muted);
}

.shop-order-meta-form__field > span {
  color: var(--text-muted);
  font-size: var(--font-size-label);
}

.shop-order-meta-form__field--delivery,
.shop-order-meta-form__field--shortcut {
  align-content: start;
}

.shop-order-meta-form__field--comments {
  --app-text-input-min-height: 2rem;
  --app-readonly-field-min-height: 2rem;
  --app-readonly-field-multiline-min-height: 2rem;
  --app-readonly-field-multiline-padding-y: 0.35rem;
}

.shop-order-meta-form__field--comments :deep(.app-text-input) {
  min-height: 2rem;
}

.shop-order-meta-form__shortcut-button {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  min-height: var(--shop-control-height);
  padding: 0 0.8rem;
  border: 1px solid var(--shop-line);
  border-radius: var(--shop-radius-md);
  background: var(--shop-field);
  color: var(--text);
  cursor: pointer;
  font-weight: 500;
  font-size: 0.95rem;
  line-height: 1;
  box-shadow: none;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.shop-order-meta-form__shortcut-button:hover:not(:disabled) {
  border-color: rgba(145, 220, 255, 0.28);
  background: var(--shop-surface-soft);
  transform: none;
}

.shop-order-meta-form__shortcut-button:disabled {
  opacity: 0.65;
}

@media (max-width: 980px) {
  .shop-order-meta-form {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 820px) {
  .shop-order-meta-form {
    gap: var(--list-gap);
  }
}
</style>
