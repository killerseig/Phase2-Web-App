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
  background: var(
    --app-link-card-background,
    linear-gradient(180deg, rgba(255, 255, 255, 0.034), rgba(255, 255, 255, 0)),
    rgba(255, 255, 255, 0.038)
  );
  box-shadow: var(--app-link-card-shadow, var(--shadow-soft));
  color: inherit;
  text-decoration: none;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;
}

.app-link-card:hover {
  transform: var(--app-link-card-hover-transform, translateY(-2px));
  border-color: var(--app-link-card-hover-border-color, var(--border-strong));
  background: var(
    --app-link-card-hover-background,
    linear-gradient(180deg, rgba(99, 199, 230, 0.13), rgba(33, 52, 65, 0.18)),
    rgba(255, 255, 255, 0.045)
  );
  box-shadow: var(
    --app-link-card-hover-shadow,
    0 14px 30px rgba(3, 10, 16, 0.18),
    0 0 0 1px rgba(255, 255, 255, 0.018)
  );
}

.app-link-card:focus-visible {
  outline: none;
  box-shadow: var(
    --app-link-card-focus-shadow,
    0 0 0 3px rgba(99, 199, 230, 0.2),
    var(--app-link-card-hover-shadow, 0 14px 30px rgba(3, 10, 16, 0.18))
  );
}
</style>
