<script setup lang="ts">
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

const handleInput = (event: Event) => {
  const value = (event.target as HTMLTextAreaElement).value
  emit('update:modelValue', value)
  emit('input')
}
</script>

<template>
  <div class="d-flex flex-column gap-1">
    <label class="form-label">{{ label }}</label>
    <textarea
      class="form-control"
      :rows="rows || 3"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="handleInput"
    />
  </div>
</template>
