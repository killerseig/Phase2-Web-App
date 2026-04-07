<script setup lang="ts">
import { computed } from 'vue'
import AppToolbarMeta from '@/components/common/AppToolbarMeta.vue'

defineOptions({
  name: 'AppDataGroupHeader',
})

interface Props {
  eyebrow?: string
  title?: string
  subtitle?: string
  titleTag?: 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p'
  titleClass?: string
  wrapperClass?: string
  summaryClass?: string
  compact?: boolean
  tone?: 'default' | 'subtle'
  summaryAlign?: 'start' | 'end'
}

const props = withDefaults(defineProps<Props>(), {
  eyebrow: '',
  title: '',
  subtitle: '',
  titleTag: 'div',
  titleClass: '',
  wrapperClass: '',
  summaryClass: '',
  compact: false,
  tone: 'default',
  summaryAlign: 'end',
})

const wrapperClasses = computed(() => [
  'app-data-group-header',
  props.tone === 'subtle' ? 'app-data-group-header--subtle' : '',
  props.summaryAlign === 'start' ? 'app-data-group-header--summary-start' : '',
  props.wrapperClass,
].filter(Boolean))

const summaryClasses = computed(() => [
  'app-data-group-header__summary',
  props.summaryClass,
].filter(Boolean))
</script>

<template>
  <div :class="wrapperClasses">
    <AppToolbarMeta
      :eyebrow="eyebrow"
      :title="title"
      :subtitle="subtitle"
      :title-tag="titleTag"
      :title-class="titleClass"
      :compact="compact"
    />

    <div v-if="$slots.summary" :class="summaryClasses">
      <slot name="summary" />
    </div>
  </div>
</template>
