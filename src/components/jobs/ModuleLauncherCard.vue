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
    <strong>{{ label }}</strong>
    <p>{{ detail }}</p>
  </AppLinkCard>
</template>

<style scoped>
.module-launcher-card {
  align-content: start;
  --app-link-card-gap: 0.35rem;
  --app-link-card-border: 1px solid var(--border);
  --app-link-card-background: var(--panel-background);
  --app-link-card-shadow: none;
  --app-link-card-hover-background: var(--field-hover);
  --app-link-card-hover-shadow: none;
}

.module-launcher-card strong {
  font-family: var(--font-heading);
  font-size: var(--font-size-pane-title);
  line-height: 1.2;
}

.module-launcher-card p {
  margin: 0;
  color: var(--text-muted);
}
</style>
