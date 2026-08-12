<script setup lang="ts">
withDefaults(defineProps<{
  eyebrow?: string
  identityClass?: string
  title: string
  titleTag?: 'strong' | 'h2' | 'h3'
}>(), {
  titleTag: 'strong',
})
</script>

<template>
  <header class="app-entity-header">
    <div :class="['app-entity-header__identity', identityClass]">
      <span v-if="eyebrow" class="app-entity-header__eyebrow">{{ eyebrow }}</span>
      <component :is="titleTag" class="app-entity-header__title">
        {{ title }}
      </component>
    </div>

    <div v-if="$slots.actions" class="app-entity-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.app-entity-header {
  display: flex;
  align-items: var(--app-entity-header-align-items, center);
  justify-content: space-between;
  flex-wrap: var(--app-entity-header-flex-wrap, wrap);
  gap: var(--app-entity-header-gap, 0.4rem);
  min-height: var(--app-entity-header-min-height, 1.4rem);
}

.app-entity-header__identity {
  display: grid;
  gap: var(--app-entity-header-identity-gap, 0.1rem);
  min-width: 0;
}

.app-entity-header__eyebrow {
  display: inline-flex;
  color: var(--app-entity-header-eyebrow-color, var(--accent-strong));
  font-size: var(--app-entity-header-eyebrow-font-size, 0.66rem);
  letter-spacing: var(--app-entity-header-eyebrow-letter-spacing, 0.14em);
  text-transform: uppercase;
}

.app-entity-header__title {
  margin: 0;
  color: var(--app-entity-header-title-color, var(--text));
  font-size: var(--app-entity-header-title-font-size, 0.94rem);
  font-weight: var(--app-entity-header-title-font-weight, 600);
  line-height: var(--app-entity-header-title-line-height, 1.2);
}

.app-entity-header__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-entity-header-actions-gap, 0.35rem);
  justify-content: flex-end;
  min-width: 0;
}
</style>
