<script setup lang="ts">
withDefaults(defineProps<{
  multiline?: boolean
}>(), {
  multiline: false,
})
</script>

<template>
  <div
    class="app-readonly-field"
    :class="{ 'app-readonly-field--multiline': multiline }"
  >
    <slot />
  </div>
</template>

<style scoped>
.app-readonly-field {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: var(--app-readonly-field-min-height, 2.8rem);
  padding: var(--app-readonly-field-padding-y, 0) var(--app-readonly-field-padding-x, 0.9rem);
  border: 1px solid var(--app-readonly-field-border, var(--border));
  border-radius: var(--app-readonly-field-radius, 12px);
  background: var(--app-readonly-field-background, rgba(255, 255, 255, 0.035));
  color: var(--app-readonly-field-color, var(--text));
  box-sizing: border-box;
  font: var(--app-readonly-field-font, inherit);
  overflow-wrap: anywhere;
}

.app-readonly-field--multiline {
  align-items: flex-start;
  min-height: var(--app-readonly-field-multiline-min-height, var(--app-readonly-field-min-height, 2.8rem));
  padding-top: var(--app-readonly-field-multiline-padding-y, 0.55rem);
  padding-bottom: var(--app-readonly-field-multiline-padding-y, 0.55rem);
  white-space: pre-wrap;
}
</style>
