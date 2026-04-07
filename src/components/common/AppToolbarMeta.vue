<script setup lang="ts">
defineOptions({
  name: 'AppToolbarMeta',
})

withDefaults(defineProps<{
  eyebrow?: string
  title?: string
  subtitle?: string
  titleTag?: 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p'
  wrapperClass?: string
  eyebrowClass?: string
  titleClass?: string
  subtitleClass?: string
  compact?: boolean
}>(), {
  eyebrow: '',
  title: '',
  subtitle: '',
  titleTag: 'div',
  wrapperClass: '',
  eyebrowClass: '',
  titleClass: '',
  subtitleClass: '',
  compact: false,
})
</script>

<template>
  <div :class="['app-toolbar-meta', compact ? 'app-toolbar-meta--compact' : '', wrapperClass]">
    <slot name="eyebrow">
      <div
        v-if="eyebrow"
        :class="['app-toolbar-meta__eyebrow', eyebrowClass]"
      >
        {{ eyebrow }}
      </div>
    </slot>

    <slot name="title">
      <component
        :is="titleTag"
        v-if="title"
        :class="['app-toolbar-meta__title', titleClass]"
      >
        {{ title }}
      </component>
    </slot>

    <slot name="subtitle">
      <div
        v-if="subtitle"
        :class="['app-toolbar-meta__subtitle', subtitleClass]"
      >
        {{ subtitle }}
      </div>
    </slot>

    <slot />
  </div>
</template>
