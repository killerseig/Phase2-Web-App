<script setup lang="ts">
import BaseTextareaField from '@/components/common/BaseTextareaField.vue'

defineProps<{
  label: string
  modelValue: string
  rows?: number
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'input'): void
}>()

const handleInput = () => {
  emit('input')
}
</script>

<template>
  <BaseTextareaField
    :label="label"
    :model-value="modelValue"
    :rows="rows || 3"
    :placeholder="placeholder"
    :disabled="disabled"
    @update:model-value="(value) => emit('update:modelValue', value)"
    @input="handleInput"
  />
</template>
