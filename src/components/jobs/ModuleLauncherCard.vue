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
  --app-link-card-background:
    radial-gradient(circle at 8% 0%, rgba(99, 199, 230, 0.06), transparent 32%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.034), rgba(255, 255, 255, 0)),
    rgba(255, 255, 255, 0.038);
  --app-link-card-shadow: 0 10px 24px rgba(3, 10, 16, 0.1);
  --app-link-card-hover-background:
    linear-gradient(180deg, rgba(99, 199, 230, 0.13), rgba(33, 52, 65, 0.18)),
    rgba(255, 255, 255, 0.045);
  --app-link-card-hover-shadow:
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
