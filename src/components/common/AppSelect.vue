<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})

defineProps<{
  modelValue: string | number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function handleChange(event: Event) {
  emit('update:modelValue', (event.target as HTMLSelectElement).value)
}
</script>

<template>
  <select
    v-bind="$attrs"
    class="app-select"
    :value="modelValue"
    @change="handleChange"
  >
    <slot />
  </select>
</template>

<style scoped>
.app-select {
  width: 100%;
  min-width: 0;
  min-height: var(--app-select-min-height, var(--control-height-form));
  padding: 0 var(--app-select-padding-x, var(--control-padding-x));
  padding-right: calc(var(--app-select-padding-x, var(--control-padding-x)) + 2.15rem);
  border: 1px solid var(--app-select-border, var(--border));
  border-radius: var(--app-select-radius, var(--control-radius));
  background-color: var(--app-select-background, var(--control-background));
  background-image:
    linear-gradient(45deg, transparent 50%, var(--text-muted) 50%),
    linear-gradient(135deg, var(--text-muted) 50%, transparent 50%);
  background-position:
    calc(100% - 1.05rem) calc(50% - 0.08rem),
    calc(100% - 0.72rem) calc(50% - 0.08rem);
  background-size: 0.42rem 0.42rem, 0.42rem 0.42rem;
  background-repeat: no-repeat;
  color: var(--text);
  font-size: var(--app-select-font-size, var(--font-size-md));
  line-height: 1.25;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  color-scheme: dark;
  box-shadow: none;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;
  cursor: pointer;
}

.app-select:hover:not(:disabled) {
  border-color: rgba(145, 220, 255, 0.34);
  background-color: var(--field-hover);
}

.app-select:focus,
.app-select:focus-visible {
  outline: none;
  border-color: var(--border-strong);
  background-color: var(--field-hover);
  box-shadow: var(--control-focus-shadow);
}

.app-select:disabled {
  cursor: not-allowed;
  opacity: 0.68;
}

.app-select option {
  background: var(--field);
  color: var(--text);
}

.app-select optgroup {
  background: var(--field);
  color: var(--text-muted);
}

.app-select::-ms-expand {
  display: none;
}
</style>
