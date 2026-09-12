<script setup lang="ts">
import AppDateInput from '@/components/common/AppDateInput.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppField from '@/components/common/AppField.vue'
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
    <AppField class="shop-order-meta-form__field shop-order-meta-form__field--delivery" label="Delivery Date">
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
    </AppField>

    <div class="shop-order-meta-form__field shop-order-meta-form__field--shortcut">
      <span>Shortcut</span>
      <AppButton
        v-if="canEdit"
        type="button"
        class="shop-order-meta-form__shortcut-button"
        data-testid="shoporder-shortcut"
        :disabled="!canEdit"
        @click="emit('applyThursdayDelivery')"
      >
        Thursday Delivery
      </AppButton>
      <AppReadonlyField
        v-else
        class="shop-order-meta-form__readonly"
        data-testid="shoporder-shortcut-readonly"
      >
        {{ isThursdayDeliveryValue(readonlyDeliveryDate) ? 'Thursday Delivery' : '-' }}
      </AppReadonlyField>
    </div>

    <AppField class="shop-order-meta-form__field shop-order-meta-form__field--comments" label="Comments">
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
    </AppField>
  </div>
</template>

<style scoped>
.shop-order-meta-form {
  display: grid;
  grid-template-columns: minmax(0, 10.5rem) minmax(0, 10.5rem) minmax(0, 1fr);
  gap: var(--field-gap);
  align-items: start;
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
  --app-readonly-field-background: var(--control-background);
  --app-readonly-field-color: var(--text);
  display: grid;
  min-width: 0;
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
  --app-readonly-field-multiline-min-height: var(--control-height-form);
  --app-readonly-field-multiline-padding-y: 0.35rem;
}

.shop-order-meta-form__shortcut-button {
  width: 100%;
  min-height: var(--shop-control-height);
  padding: 0 0.8rem;
}

@container shop-order-workspace (max-width: 40rem) {
  .shop-order-meta-form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .shop-order-meta-form__field--comments {
    grid-column: 1 / -1;
  }
}

@container shop-order-workspace (max-width: 24rem) {
  .shop-order-meta-form {
    grid-template-columns: 1fr;
  }
}

</style>
