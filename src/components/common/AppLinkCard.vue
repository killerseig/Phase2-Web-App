<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'

defineProps<{
  to: RouteLocationRaw
}>()
</script>

<template>
  <RouterLink :to="to" class="app-link-card">
    <slot />
  </RouterLink>
</template>

<style scoped>
.app-link-card {
  display: grid;
  gap: var(--app-link-card-gap, 0.65rem);
  min-width: 0;
  padding: var(--app-link-card-padding, 1rem);
  border: var(--app-link-card-border, 1px solid var(--border));
  border-radius: var(--app-link-card-radius, var(--radius));
  background: var(--app-link-card-background, var(--surface));
  box-shadow: var(--app-link-card-shadow, var(--shadow-soft));
  color: inherit;
  text-decoration: none;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;
}

.app-link-card:hover {
  transform: none;
  border-color: var(--app-link-card-hover-border-color, var(--border-strong));
  background: var(--app-link-card-hover-background, var(--field-hover));
  box-shadow: var(--app-link-card-hover-shadow, none);
}

.app-link-card:focus-visible {
  outline: none;
  box-shadow: var(--app-link-card-focus-shadow, var(--focus-ring));
}

:slotted(strong) {
  font-weight: var(--font-weight-heading);
}
</style>
