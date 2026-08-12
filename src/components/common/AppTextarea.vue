<script setup lang="ts">
import { readInputValue } from '@/utils/domEvents'

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
  emit('update:modelValue', readInputValue(event))
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
  color: var(--app-textarea-color, var(--text));
  color-scheme: var(--app-textarea-color-scheme, dark);
  box-shadow: var(--app-textarea-box-shadow, none);
  box-sizing: border-box;
  font: var(--app-textarea-font, inherit);
  resize: var(--app-textarea-resize, vertical);
}

.app-textarea:disabled {
  cursor: not-allowed;
}

.app-textarea::placeholder {
  color: var(--app-textarea-placeholder-color, var(--text-muted));
}

.app-textarea:focus-visible {
  border-color: var(--app-textarea-focus-border, var(--border-strong));
  outline: var(--app-textarea-focus-outline, none);
  outline-offset: var(--app-textarea-focus-outline-offset, 0);
  background: var(--app-textarea-focus-background, var(--field-hover));
  box-shadow: var(
    --app-textarea-focus-box-shadow,
    var(--focus-ring),
    inset 0 1px 0 rgba(255, 255, 255, 0.05)
  );
}
</style>
