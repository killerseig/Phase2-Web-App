<script setup lang="ts">
withDefaults(defineProps<{
  description?: string
  eyebrow?: string
  title: string
  titleTag?: 'span' | 'strong' | 'h2' | 'h3'
}>(), {
  titleTag: 'span',
})
</script>

<template>
  <header class="app-section-header">
    <div class="app-section-header__copy">
      <span v-if="eyebrow" class="app-section-header__eyebrow">{{ eyebrow }}</span>

      <component :is="titleTag" class="app-section-header__title">
        {{ title }}
      </component>

      <p v-if="description || $slots.description" class="app-section-header__description">
        <slot name="description">{{ description }}</slot>
      </p>
    </div>

    <div v-if="$slots.actions" class="app-section-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.app-section-header {
  display: flex;
  align-items: var(--app-section-header-align-items, center);
  justify-content: space-between;
  flex-direction: var(--app-section-header-flex-direction, row);
  flex-wrap: var(--app-section-header-flex-wrap, wrap);
  gap: var(--app-section-header-gap, 0.65rem);
  min-width: 0;
  min-height: var(--app-section-header-min-height, auto);
}

.app-section-header__copy {
  display: grid;
  gap: var(--app-section-header-copy-gap, 0.18rem);
  min-width: 0;
}

.app-section-header__eyebrow {
  color: var(--app-section-header-eyebrow-color, var(--text-muted));
  font-size: var(--app-section-header-eyebrow-font-size, var(--font-size-eyebrow));
  font-weight: var(--app-section-header-eyebrow-font-weight, 500);
  line-height: var(--app-section-header-eyebrow-line-height, 1.2);
  letter-spacing: var(--app-section-header-eyebrow-letter-spacing, var(--letter-spacing-eyebrow));
  text-transform: var(--app-section-header-eyebrow-text-transform, uppercase);
}

.app-section-header__title {
  margin: 0;
  color: var(--app-section-header-title-color, var(--accent-strong));
  font-size: var(--app-section-header-title-font-size, var(--font-size-eyebrow));
  font-weight: var(--app-section-header-title-font-weight, 500);
  line-height: var(--app-section-header-title-line-height, 1.2);
  letter-spacing: var(--app-section-header-title-letter-spacing, var(--letter-spacing-eyebrow));
  text-transform: var(--app-section-header-title-text-transform, uppercase);
}

.app-section-header__description {
  margin: 0;
  color: var(--app-section-header-description-color, var(--text-muted));
  font-size: var(--app-section-header-description-font-size, 0.88rem);
  line-height: var(--app-section-header-description-line-height, 1.4);
}

.app-section-header__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--app-section-header-actions-gap, 0.35rem);
  min-width: 0;
}
</style>
