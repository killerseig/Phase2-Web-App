<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})

defineProps<{
  label?: string
}>()
</script>

<template>
  <label v-bind="$attrs" class="app-field">
    <span v-if="label" class="app-field__label">{{ label }}</span>
    <slot />
    <span v-if="$slots.help" class="app-field__help">
      <slot name="help" />
    </span>
  </label>
</template>

<style scoped>
.app-field {
  display: grid;
  gap: var(--app-field-gap, 0.45rem);
  color: var(--app-field-color, var(--text-muted));
}

.app-field__label {
  color: var(--app-field-label-color, inherit);
  font-size: var(--app-field-label-font-size, 0.9rem);
  font-weight: var(--app-field-label-font-weight, inherit);
  letter-spacing: var(--app-field-label-letter-spacing, normal);
  text-transform: var(--app-field-label-text-transform, none);
}

.app-field__help {
  color: var(--text-muted);
  font-size: var(--app-field-help-font-size, 0.82rem);
}
</style>
