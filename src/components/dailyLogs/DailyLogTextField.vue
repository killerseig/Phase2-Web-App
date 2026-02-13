<script setup lang="ts">
const props = defineProps<{
  label: string
  modelValue: string
  rows?: number
  placeholder?: string
  disabled?: boolean
  onInput?: () => void
}>()

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const handleInput = (event: Event) => {
  const value = (event.target as HTMLTextAreaElement).value
  emit('update:modelValue', value)
  props.onInput?.()
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
