<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  description: string
  highlights: string[]
}>()
</script>

<template>
  <section class="module-placeholder">
    <div class="module-placeholder__hero">
      <span class="module-placeholder__eyebrow">{{ eyebrow }}</span>
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
    </div>

    <div class="module-placeholder__list">
      <article
        v-for="item in highlights"
        :key="item"
        class="module-placeholder__list-item"
      >
        {{ item }}
      </article>
    </div>
  </section>
</template>

<style scoped>
.module-placeholder {
  display: grid;
  gap: 1rem;
  padding: 1.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--panel-background);
}

.module-placeholder__eyebrow {
  color: var(--accent-strong);
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.module-placeholder__hero h2 {
  margin: 0;
  font-size: 1.35rem;
}

.module-placeholder__hero p {
  margin: 0.55rem 0 0;
  color: var(--text-muted);
}

.module-placeholder__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.85rem;
}

.module-placeholder__list-item {
  display: grid;
  gap: 0.35rem;
  padding: 1rem;
  border: 1px solid rgba(168, 190, 209, 0.16);
  border-radius: var(--radius);
  background: var(--panel-background);
  box-shadow: none;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;
}
</style>
