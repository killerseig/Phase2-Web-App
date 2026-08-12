<script setup lang="ts">
import { computed } from 'vue'

type AppPaneDensity = 'compact' | 'default' | 'spacious'
type AppPaneElevation = 'default' | 'flat' | 'floating'
type AppPaneTone = 'accent' | 'default' | 'muted'

const props = withDefaults(defineProps<{
  as?: 'section' | 'article' | 'aside' | 'div'
  density?: AppPaneDensity
  elevation?: AppPaneElevation
  tone?: AppPaneTone
}>(), {
  as: 'section',
  density: 'default',
  elevation: 'default',
  tone: 'default',
})

const paneClasses = computed(() => [
  'app-pane',
  props.density !== 'default' ? `app-pane--density-${props.density}` : '',
  props.elevation !== 'default' ? `app-pane--elevation-${props.elevation}` : '',
  props.tone !== 'default' ? `app-pane--tone-${props.tone}` : '',
])
</script>

<template>
  <component :is="as" :class="paneClasses">
    <slot />
  </component>
</template>

<style scoped>
.app-pane {
  display: grid;
  grid-template-rows: var(--app-pane-grid-template-rows, auto minmax(0, 1fr));
  gap: var(--app-pane-gap, 1rem);
  min-height: var(--app-pane-min-height, 0);
  height: var(--app-pane-height, 100%);
  overflow: var(--app-pane-overflow, hidden);
  padding: var(--app-pane-padding, var(--space-4));
  border: var(--app-pane-border, 1px solid var(--color-border));
  border-radius: var(--app-pane-radius, var(--radius-md));
  background: var(
    --app-pane-background,
    linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0)),
    var(--color-surface-raised)
  );
  color: var(--app-pane-color, var(--color-text));
  box-shadow: var(--app-pane-shadow, var(--shadow-md));
}

.app-pane--density-compact {
  --app-pane-gap: var(--space-2);
  --app-pane-padding: var(--space-3);
}

.app-pane--density-spacious {
  --app-pane-gap: var(--space-5);
  --app-pane-padding: var(--space-6);
}

.app-pane--elevation-flat {
  --app-pane-shadow: none;
}

.app-pane--elevation-floating {
  --app-pane-shadow: var(--shadow-lg);
}

.app-pane--tone-muted {
  --app-pane-background: var(--color-surface-glass);
  --app-pane-border: 1px solid var(--color-border-soft);
}

.app-pane--tone-accent {
  --app-pane-background:
    linear-gradient(180deg, rgba(99, 199, 230, 0.095), rgba(255, 255, 255, 0.018)),
    var(--color-surface-raised);
  --app-pane-border: 1px solid var(--color-border-strong);
}
</style>
