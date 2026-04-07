<script setup lang="ts">
import BaseAccordionCard from '@/components/common/BaseAccordionCard.vue'
import BaseFormActions from '@/components/common/BaseFormActions.vue'

withDefaults(defineProps<{
  open: boolean
  title: string
  subtitle?: string
  formClass?: string
  bodyClass?: string
  loading?: boolean
  submitLabel?: string
  cancelLabel?: string
  submitDisabled?: boolean
  cancelDisabled?: boolean
}>(), {
  subtitle: '',
  formClass: 'row g-3',
  bodyClass: 'p-3',
  loading: false,
  submitLabel: 'Save',
  cancelLabel: 'Cancel',
  submitDisabled: false,
  cancelDisabled: false,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: []
  cancel: []
  toggle: [value: boolean]
}>()
</script>

<template>
  <BaseAccordionCard
    :open="open"
    :title="title"
    :subtitle="subtitle"
    :body-class="bodyClass"
    @update:open="(value) => emit('update:open', value)"
    @toggle="(value) => emit('toggle', value)"
  >
    <form :class="formClass" @submit.prevent="emit('submit')">
      <slot />
      <BaseFormActions
        :loading="loading"
        :submit-label="submitLabel"
        :cancel-label="cancelLabel"
        :submit-disabled="submitDisabled"
        :cancel-disabled="cancelDisabled"
        @cancel="emit('cancel')"
      />
    </form>
  </BaseAccordionCard>
</template>
