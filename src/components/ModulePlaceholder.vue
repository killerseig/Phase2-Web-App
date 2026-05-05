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
      <span class="page-panel__eyebrow">{{ eyebrow }}</span>
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
