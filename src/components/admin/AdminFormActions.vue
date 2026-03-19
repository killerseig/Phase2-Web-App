<script setup lang="ts">
const props = withDefaults(defineProps<{
  loading?: boolean
  submitLabel?: string
  cancelLabel?: string
  submitDisabled?: boolean
  cancelDisabled?: boolean
  submitType?: 'submit' | 'button'
  wrapperClass?: string
  cancelButtonClass?: string
  submitButtonClass?: string
}>(), {
  loading: false,
  submitLabel: 'Save',
  cancelLabel: 'Cancel',
  submitDisabled: false,
  cancelDisabled: false,
  submitType: 'submit',
  wrapperClass: 'col-12 d-flex gap-2 justify-content-end pt-2',
  cancelButtonClass: 'btn btn-outline-secondary',
  submitButtonClass: 'btn btn-primary',
})

const emit = defineEmits<{
  cancel: []
  submit: []
}>()

function handleSubmitClick() {
  if (props.submitType === 'button') {
    emit('submit')
  }
}
</script>

<template>
  <div :class="wrapperClass">
    <button
      type="button"
      :class="cancelButtonClass"
      :disabled="loading || cancelDisabled"
      @click="emit('cancel')"
    >
      {{ cancelLabel }}
    </button>
    <button
      :type="submitType"
      :class="submitButtonClass"
      :disabled="loading || submitDisabled"
      @click="handleSubmitClick"
    >
      <span
        v-if="loading"
        class="spinner-border spinner-border-sm me-2"
        role="status"
        aria-hidden="true"
      ></span>
      {{ submitLabel }}
    </button>
  </div>
</template>
