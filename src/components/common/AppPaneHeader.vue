<script setup lang="ts">
defineProps<{
  description?: string
  eyebrow?: string
  title: string
  titleTag?: 'h1' | 'h2' | 'h3'
}>()
</script>

<template>
  <header class="app-pane-header">
    <div class="app-pane-header__copy">
      <slot name="copy-prefix" />
      <span v-if="eyebrow" class="app-pane-header__eyebrow">{{ eyebrow }}</span>
      <component :is="titleTag ?? 'h1'" class="app-pane-header__title">
        {{ title }}
      </component>
      <p v-if="description || $slots.description" class="app-pane-header__description">
        <slot name="description">{{ description }}</slot>
      </p>
    </div>

    <div v-if="$slots.actions" class="app-pane-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.app-pane-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.app-pane-header__copy,
.app-pane-header__actions {
  min-width: 0;
}

.app-pane-header__eyebrow {
  color: var(--text-muted);
  font-size: var(--app-pane-header-eyebrow-font-size, var(--font-size-eyebrow));
  letter-spacing: var(--app-pane-header-eyebrow-letter-spacing, var(--letter-spacing-eyebrow));
  text-transform: uppercase;
}

.app-pane-header__title {
  margin: var(--app-pane-header-title-margin, 0.35rem 0 0);
  font-size: var(--app-pane-header-title-font-size, var(--font-size-pane-title));
  overflow-wrap: anywhere;
}

.app-pane-header__description {
  margin: var(--app-pane-header-description-margin, 0.35rem 0 0);
  color: var(--app-pane-header-description-color, var(--text-muted));
  font-size: var(--app-pane-header-description-font-size, 1rem);
  line-height: var(--app-pane-header-description-line-height, 1.4);
}

.app-pane-header__actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 720px) {
  .app-pane-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .app-pane-header__actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
