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
  padding: var(--app-card-padding, var(--space-4));
  border: var(--app-card-border, 1px solid var(--color-border));
  border-radius: var(--app-card-radius, var(--radius-md));
  background: var(
    --app-card-background,
    linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0)),
    var(--color-surface-raised)
  );
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
  --app-card-background:
    linear-gradient(180deg, rgba(99, 199, 230, 0.095), rgba(255, 255, 255, 0.018)),
    var(--color-surface-raised);
  --app-card-border: 1px solid var(--color-border-strong);
}
</style>
