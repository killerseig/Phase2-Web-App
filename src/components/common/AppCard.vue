<script setup lang="ts">
import { computed } from 'vue'

type AppCardDensity = 'compact' | 'default' | 'spacious'
type AppCardElevation = 'default' | 'flat' | 'floating'
type AppCardTone = 'accent' | 'default' | 'muted'

const props = withDefaults(defineProps<{
  as?: 'article' | 'section' | 'div'
  density?: AppCardDensity
  elevation?: AppCardElevation
  tone?: AppCardTone
}>(), {
  as: 'article',
  density: 'default',
  elevation: 'default',
  tone: 'default',
})

const cardClasses = computed(() => [
  'app-card',
  props.density !== 'default' ? `app-card--density-${props.density}` : '',
  props.elevation !== 'default' ? `app-card--elevation-${props.elevation}` : '',
  props.tone !== 'default' ? `app-card--tone-${props.tone}` : '',
])
</script>

<template>
  <component :is="as" :class="cardClasses">
    <slot />
  </component>
</template>

<style scoped>
.app-card {
  display: grid;
  gap: var(--app-card-gap, var(--space-3));
  min-height: var(--app-card-min-height, auto);
  min-width: 0;
  padding: var(--app-card-padding, var(--space-4));
  border: var(--app-card-border, 1px solid var(--color-border));
  border-radius: var(--app-card-radius, var(--radius-md));
  background: var(--app-card-background, var(--panel-background));
  color: var(--app-card-color, var(--color-text));
  box-shadow: var(--app-card-shadow, var(--shadow-md));
}

.app-card--density-compact {
  --app-card-gap: var(--space-2);
  --app-card-padding: var(--space-3);
}

.app-card--density-spacious {
  --app-card-gap: var(--space-5);
  --app-card-padding: var(--space-6);
}

.app-card--elevation-flat {
  --app-card-shadow: none;
}

.app-card--elevation-floating {
  --app-card-shadow: var(--shadow-lg);
}

.app-card--tone-muted {
  --app-card-background: var(--color-surface-glass);
  --app-card-border: 1px solid var(--color-border-soft);
}

.app-card--tone-accent {
  --app-card-background: var(--bg-accent);
  --app-card-border: 1px solid var(--color-border-strong);
}
</style>
