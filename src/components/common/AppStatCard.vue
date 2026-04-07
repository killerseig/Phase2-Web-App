<script setup lang="ts">
import { computed } from 'vue'
import BaseCard from '@/components/common/BaseCard.vue'

defineOptions({
  name: 'AppStatCard',
})

interface Props {
  label: string
  value: string | number
  helperText?: string
  valueClass?: string
  cardClass?: string
  tone?: 'default' | 'accent'
}

const props = withDefaults(defineProps<Props>(), {
  helperText: '',
  valueClass: '',
  cardClass: '',
  tone: 'default',
})

const cardClasses = computed(() => [
  'app-stat-card',
  props.tone === 'accent' ? 'app-stat-card--accent' : '',
  props.cardClass,
].filter(Boolean).join(' '))
</script>

<template>
  <BaseCard
    :card-class="cardClasses"
    body-class="h-100"
  >
    <div class="app-stat-card__label">{{ label }}</div>
    <div :class="['app-stat-card__value', valueClass]">{{ value }}</div>
    <div v-if="helperText" class="app-stat-card__helper">{{ helperText }}</div>
  </BaseCard>
</template>
