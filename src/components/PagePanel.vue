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
