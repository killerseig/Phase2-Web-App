<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{
  detail: string
  label: string
  testId: string
  to: string
}>()
</script>

<template>
  <RouterLink
    :to="to"
    class="module-launcher-card"
    :data-testid="testId"
  >
    <span class="module-launcher-card__eyebrow">{{ label }}</span>
    <strong>{{ label }}</strong>
    <p>{{ detail }}</p>
  </RouterLink>
</template>

<style scoped>
.module-launcher-card {
  display: grid;
  gap: 0.35rem;
  padding: 1rem;
  border: 1px solid rgba(168, 190, 209, 0.16);
  border-radius: var(--radius);
  background:
    radial-gradient(circle at 8% 0%, rgba(99, 199, 230, 0.06), transparent 32%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.034), rgba(255, 255, 255, 0)),
    rgba(255, 255, 255, 0.038);
  box-shadow: 0 10px 24px rgba(3, 10, 16, 0.1);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;
}

.module-launcher-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  background:
    linear-gradient(180deg, rgba(99, 199, 230, 0.13), rgba(33, 52, 65, 0.18)),
    rgba(255, 255, 255, 0.045);
  box-shadow:
    0 14px 30px rgba(3, 10, 16, 0.18),
    0 0 0 1px rgba(255, 255, 255, 0.018);
}

.module-launcher-card__eyebrow {
  color: var(--accent-strong);
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.module-launcher-card p {
  color: var(--text-muted);
}
</style>
