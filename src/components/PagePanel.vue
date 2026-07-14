<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  description?: string
}>()
</script>

<template>
  <section class="page-panel">
    <header class="page-panel__header">
      <span class="page-panel__eyebrow">{{ eyebrow }}</span>
      <h2 class="page-panel__title">{{ title }}</h2>
      <p v-if="description" class="page-panel__description">{{ description }}</p>
    </header>

    <div class="page-panel__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.page-panel {
  border: 1px solid rgba(168, 190, 209, 0.18);
  border-radius: var(--radius-lg);
  background:
    radial-gradient(circle at 8% 0%, rgba(99, 199, 230, 0.08), transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0)),
    var(--surface);
  box-shadow: var(--shadow-soft);
}

.page-panel__header {
  padding: 1.1rem 1.25rem 0;
}

.page-panel__eyebrow {
  color: var(--accent-strong);
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.page-panel__title {
  margin: 0.45rem 0 0;
  font-size: 1.2rem;
}

.page-panel__description {
  margin: 0.45rem 0 0;
  color: var(--text-muted);
}

.page-panel__body {
  padding: 1.25rem;
}
</style>
