<script setup lang="ts">
import BaseFormActions from '@/components/common/BaseFormActions.vue'
import BaseModal from '@/components/common/BaseModal.vue'

interface Props {
  open: boolean
  title?: string
  size?: 'sm' | 'lg' | 'xl'
  centered?: boolean
  loading?: boolean
  submitLabel?: string
  cancelLabel?: string
  submitDisabled?: boolean
  cancelDisabled?: boolean
  closeDisabled?: boolean
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  hideClose?: boolean
  formClass?: string
  contentClass?: string
  headerClass?: string
  bodyClass?: string
  footerClass?: string
  closeButtonClass?: string
  cancelButtonClass?: string
  submitButtonClass?: string
}

withDefaults(defineProps<Props>(), {
  title: '',
  size: undefined,
  centered: true,
  loading: false,
  submitLabel: 'Save',
  cancelLabel: 'Cancel',
  submitDisabled: false,
  cancelDisabled: false,
  closeDisabled: false,
  closeOnBackdrop: true,
  closeOnEscape: true,
  hideClose: false,
  formClass: '',
  contentClass: '',
  headerClass: '',
  bodyClass: '',
  footerClass: '',
  closeButtonClass: '',
  cancelButtonClass: 'btn btn-secondary',
  submitButtonClass: 'btn btn-primary',
})

const emit = defineEmits<{
  close: []
  cancel: []
  submit: []
}>()

function handleClose() {
  emit('close')
  emit('cancel')
}

function handleSubmit() {
  emit('submit')
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="title"
    :size="size"
    :centered="centered"
    :content-class="contentClass"
    :header-class="headerClass"
    :body-class="bodyClass"
    :footer-class="footerClass"
    :close-button-class="closeButtonClass"
    :hide-close="hideClose"
    :close-disabled="loading || closeDisabled"
    :close-on-backdrop="closeOnBackdrop && !loading && !closeDisabled"
    :close-on-escape="closeOnEscape && !loading && !closeDisabled"
    @close="handleClose"
  >
    <form :class="formClass" @submit.prevent="handleSubmit">
      <slot />
    </form>

    <template #footer>
      <slot name="footer">
        <BaseFormActions
          submit-type="button"
          wrapper-class="d-flex gap-2 justify-content-end w-100"
          :loading="loading"
          :submit-label="submitLabel"
          :cancel-label="cancelLabel"
          :submit-disabled="submitDisabled"
          :cancel-disabled="cancelDisabled"
          :cancel-button-class="cancelButtonClass"
          :submit-button-class="submitButtonClass"
          @cancel="emit('cancel')"
          @submit="handleSubmit"
        />
      </slot>
    </template>
  </BaseModal>
</template>
