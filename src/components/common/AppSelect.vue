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
  min-height: var(--app-select-min-height, 2.9rem);
  padding: 0 var(--app-select-padding-x, 0.95rem);
  padding-right: calc(var(--app-select-padding-x, 0.95rem) + 2.15rem);
  border: 1px solid var(--app-select-border, rgba(168, 190, 209, 0.2));
  border-radius: var(--app-select-radius, var(--radius-sm));
  background-color: var(--app-select-background, var(--field));
  background-image:
    linear-gradient(45deg, transparent 50%, rgba(217, 229, 239, 0.95) 50%),
    linear-gradient(135deg, rgba(217, 229, 239, 0.95) 50%, transparent 50%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0));
  background-position:
    calc(100% - 1.05rem) calc(50% - 0.08rem),
    calc(100% - 0.72rem) calc(50% - 0.08rem),
    center;
  background-size:
    0.42rem 0.42rem,
    0.42rem 0.42rem,
    100% 100%;
  background-repeat: no-repeat;
  color: var(--text);
  line-height: 1.25;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  color-scheme: dark;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.055),
    0 8px 18px rgba(4, 10, 16, 0.16);
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease;
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
  background-color: rgba(99, 199, 230, 0.09);
  box-shadow:
    var(--focus-ring),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.app-select:disabled {
  cursor: not-allowed;
  opacity: 0.68;
}

.app-select option {
  background: #192430;
  color: var(--text);
}

.app-select optgroup {
  background: #192430;
  color: var(--text-muted);
}

.app-select::-ms-expand {
  display: none;
}
</style>
