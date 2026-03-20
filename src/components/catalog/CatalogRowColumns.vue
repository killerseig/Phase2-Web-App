<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  name: 'CatalogRowColumns',
})

interface Props {
  label: string
  sku?: string | null
  price?: number | null
  archived?: boolean
  context?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  sku: null,
  price: null,
  archived: false,
  context: null,
})

const formattedPrice = computed(() => (
  props.price == null ? '' : `$${props.price.toFixed(2)}`
))

const displaySku = computed(() => {
  const value = props.sku?.trim()
  return value ? value : ''
})
</script>

<template>
  <div class="catalog-row-columns" :class="{ 'is-archived': archived }">
    <div class="catalog-row-columns__name">
      <span class="catalog-row-columns__label">{{ label }}</span>
      <span v-if="context" class="catalog-row-columns__context">{{ context }}</span>
      <span v-if="archived" class="catalog-row-columns__status">Archived</span>
    </div>
    <span
      class="catalog-row-columns__cell catalog-row-columns__cell--sku"
    >
      {{ displaySku }}
    </span>
    <span
      class="catalog-row-columns__cell catalog-row-columns__cell--price"
    >
      {{ formattedPrice }}
    </span>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_catalogColumns.scss';
</style>
