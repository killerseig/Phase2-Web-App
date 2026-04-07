<script setup lang="ts">
defineOptions({
  name: 'BaseFieldShell',
})

interface Props {
  id?: string
  label?: string
  labelClass?: string
  wrapperClass?: string
  required?: boolean
  helperText?: string
  helperClass?: string
}

withDefaults(defineProps<Props>(), {
  id: '',
  label: '',
  labelClass: '',
  wrapperClass: '',
  required: false,
  helperText: '',
  helperClass: '',
})
</script>

<template>
  <div :class="['app-field', wrapperClass]">
    <label v-if="label || $slots.label" :for="id || undefined" :class="['form-label', labelClass]">
      <slot name="label">
        {{ label }}
      </slot>
      <span v-if="required" class="text-danger">*</span>
    </label>

    <slot />

    <div v-if="helperText || $slots.helper" :class="['form-text', helperClass]">
      <slot name="helper">
        {{ helperText }}
      </slot>
    </div>
  </div>
</template>
