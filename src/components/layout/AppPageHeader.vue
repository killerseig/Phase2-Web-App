<script setup lang="ts">
import { computed, useSlots } from 'vue'

interface Props {
  eyebrow?: string
  title: string
  subtitle?: string
  titleTag?: 'h1' | 'h2' | 'h3' | 'div'
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  eyebrow: '',
  subtitle: '',
  titleTag: 'h1',
  compact: false,
})

const slots = useSlots()

const hasAside = computed(() => Boolean(slots.badges || slots.actions || slots.aside))
</script>

<template>
  <div :class="['app-page__header', props.compact ? 'app-page__header--compact' : '']">
    <div class="app-page__intro">
      <div v-if="eyebrow" class="app-page__eyebrow">{{ props.eyebrow }}</div>
      <component :is="props.titleTag" class="app-page__title">{{ props.title }}</component>
      <p v-if="subtitle" class="app-page__subtitle">{{ props.subtitle }}</p>
      <div v-if="$slots.meta" class="app-page__meta">
        <slot name="meta" />
      </div>
    </div>

    <div v-if="hasAside" class="app-page__aside">
      <slot name="aside">
        <div v-if="$slots.badges" class="app-page__badges">
          <slot name="badges" />
        </div>
        <div v-if="$slots.actions" class="app-page__actions">
          <slot name="actions" />
        </div>
      </slot>
    </div>
  </div>
</template>
