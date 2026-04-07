<script setup lang="ts">
import { computed, useSlots } from 'vue'
import BaseCard from '@/components/common/BaseCard.vue'
import AppDataGroupHeader from '@/components/common/AppDataGroupHeader.vue'

defineOptions({
  name: 'AppDataGroupCard',
})

interface Props {
  eyebrow?: string
  title?: string
  subtitle?: string
  titleTag?: 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p'
  titleClass?: string
  cardClass?: string
  bodyClass?: string
  headerClass?: string
  compactHeader?: boolean
  tone?: 'default' | 'accent'
  summaryAlign?: 'start' | 'end'
}

const props = withDefaults(defineProps<Props>(), {
  eyebrow: '',
  title: '',
  subtitle: '',
  titleTag: 'div',
  titleClass: '',
  cardClass: '',
  bodyClass: '',
  headerClass: '',
  compactHeader: false,
  tone: 'default',
  summaryAlign: 'end',
})

const slots = useSlots()

const cardClasses = computed(() => [
  'app-data-group-card',
  props.tone === 'accent' ? 'app-data-group-card--accent' : '',
  props.cardClass,
].filter(Boolean).join(' '))

const hasHeader = computed(() => (
  Boolean(props.eyebrow || props.title || props.subtitle || slots.summary)
))
</script>

<template>
  <BaseCard
    :card-class="cardClasses"
    :body-class="bodyClass"
    :header-class="headerClass"
  >
    <template v-if="hasHeader" #header>
      <AppDataGroupHeader
        :eyebrow="eyebrow"
        :title="title"
        :subtitle="subtitle"
        :title-tag="titleTag"
        :title-class="titleClass"
        :compact="compactHeader"
        :summary-align="summaryAlign"
      >
        <template v-if="$slots.summary" #summary>
          <slot name="summary" />
        </template>
      </AppDataGroupHeader>
    </template>

    <slot />
  </BaseCard>
</template>
