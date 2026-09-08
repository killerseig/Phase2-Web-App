<script setup lang="ts">
import { readInputValue } from '@/utils/domEvents'

defineOptions({
  inheritAttrs: false,
})

withDefaults(defineProps<{
  modelValue: string | number
  type?: string
}>(), {
  type: 'text',
})

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
  <input
    v-bind="$attrs"
    class="app-text-input"
    :type="type"
    :value="modelValue"
    @input="handleInput"
  />
</template>

<style scoped>
.app-text-input {
  width: 100%;
  min-width: 0;
  min-height: var(--app-text-input-min-height, var(--control-height-form));
  padding: 0 var(--app-text-input-padding-x, var(--control-padding-x));
  border: 1px solid var(--app-text-input-border, var(--border));
  border-radius: var(--app-text-input-radius, var(--control-radius));
  background: var(--app-text-input-background, var(--control-background));
  color: var(--app-text-input-color, var(--text));
  color-scheme: var(--app-text-input-color-scheme, dark);
  box-sizing: border-box;
  font: var(--app-text-input-font, inherit);
  box-shadow: var(--app-text-input-box-shadow, none);
}

.app-text-input:disabled {
  cursor: not-allowed;
}

.app-text-input:focus-visible {
  border-color: var(--app-text-input-focus-border, var(--border-strong));
  outline: var(--app-text-input-focus-outline, none);
  outline-offset: var(--app-text-input-focus-outline-offset, 0);
  background: var(--app-text-input-focus-background, var(--field-hover));
  box-shadow: var(--app-text-input-focus-box-shadow, var(--control-focus-shadow));
}

.app-text-input::placeholder {
  color: var(--app-text-input-placeholder-color, var(--text-muted));
}
</style>
