<script setup lang="ts">
import AppLinkCard from '@/components/common/AppLinkCard.vue'

defineProps<{
  detail: string
  label: string
  testId: string
  to: string
}>()
</script>

<template>
  <AppLinkCard
    :to="to"
    class="module-launcher-card"
    :data-testid="testId"
  >
    <span class="module-launcher-card__eyebrow">{{ label }}</span>
    <strong>{{ label }}</strong>
    <p>{{ detail }}</p>
  </AppLinkCard>
</template>

<style scoped>
.module-launcher-card {
  --app-link-card-gap: 0.35rem;
  --app-link-card-border: 1px solid rgba(168, 190, 209, 0.16);
  --app-link-card-background: var(--panel-background);
  --app-link-card-shadow: none;
  --app-link-card-hover-background: var(--field-hover);
  --app-link-card-hover-shadow: none;
}

.module-launcher-card__eyebrow {
  color: var(--text-muted);
  font-size: var(--font-size-eyebrow);
  letter-spacing: var(--letter-spacing-eyebrow);
  text-transform: uppercase;
  font-weight: 500;
}

.module-launcher-card p {
  color: var(--text-muted);
}
</style>
