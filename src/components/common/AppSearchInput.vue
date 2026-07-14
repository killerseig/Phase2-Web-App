<script setup lang="ts">
import { readInputValue } from '@/utils/domEvents'

defineOptions({
  inheritAttrs: false,
})

withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  ariaLabel?: string
}>(), {
  placeholder: 'Search',
  ariaLabel: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function handleInput(event: Event) {
  emit('update:modelValue', readInputValue(event))
}
</script>

<template>
  <input
    v-bind="$attrs"
    class="app-search-input"
    type="search"
    :value="modelValue"
    :placeholder="placeholder"
    :aria-label="ariaLabel || placeholder"
    @input="handleInput"
  />
</template>

<style scoped>
.app-search-input {
  width: 100%;
  min-height: var(--app-search-input-min-height, 2.8rem);
  padding: 0 var(--app-search-input-padding-x, 0.9rem);
  border: 1px solid var(--app-search-input-border, var(--border));
  border-radius: var(--app-search-input-radius, 12px);
  background: var(--app-search-input-background, rgba(255, 255, 255, 0.045));
  color: var(--app-search-input-color, var(--text));
  color-scheme: var(--app-search-input-color-scheme, dark);
  box-sizing: border-box;
  font: var(--app-search-input-font, inherit);
  box-shadow: var(--app-search-input-box-shadow, none);
}

.app-search-input:focus-visible {
  border-color: var(--app-search-input-focus-border, rgba(88, 186, 233, 0.55));
  outline: var(--app-search-input-focus-outline, 2px solid rgba(88, 186, 233, 0.18));
  outline-offset: var(--app-search-input-focus-outline-offset, 2px);
  background-color: var(--app-search-input-focus-background, var(--app-search-input-background, rgba(255, 255, 255, 0.045)));
  box-shadow: var(--app-search-input-focus-box-shadow, none);
}

.app-search-input::placeholder {
  color: var(--app-search-input-placeholder-color, var(--text-muted));
}
</style>
