<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})

defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  input: [event: Event]
}>()

function handleInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
  emit('input', event)
}
</script>

<template>
  <textarea
    v-bind="$attrs"
    class="app-textarea"
    :value="modelValue"
    @input="handleInput"
  ></textarea>
</template>

<style scoped>
.app-textarea {
  width: 100%;
  min-height: var(--app-textarea-min-height, 7rem);
  padding: var(--app-textarea-padding, 0.75rem 0.85rem);
  border: 1px solid var(--app-textarea-border, var(--border));
  border-radius: var(--app-textarea-radius, 12px);
  background: var(--app-textarea-background, rgba(255, 255, 255, 0.045));
  color: var(--text);
  color-scheme: dark;
  box-shadow: var(--app-textarea-box-shadow, none);
  resize: var(--app-textarea-resize, vertical);
}

.app-textarea:disabled {
  cursor: not-allowed;
}

.app-textarea::placeholder {
  color: var(--text-muted);
}
</style>
