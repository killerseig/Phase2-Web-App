<script setup lang="ts">
import { computed } from 'vue'
import AppBadge from '@/components/common/AppBadge.vue'

defineOptions({
  name: 'CatalogMetadataBadges',
})

interface Props {
  archived?: boolean
  sku?: string | null
  price?: number | null
}

const props = withDefaults(defineProps<Props>(), {
  archived: false,
  sku: null,
  price: null,
})

const hasBadges = computed(() => props.archived || !!props.sku || props.price != null)
const formattedPrice = computed(() => (
  props.price == null ? '' : `$${props.price.toFixed(2)}`
))
</script>

<template>
  <span v-if="hasBadges" class="catalog-metadata-badges d-inline-flex align-items-center flex-wrap gap-1 ms-2">
    <AppBadge v-if="archived" label="archived" variant-class="bg-secondary bg-opacity-75" />
    <AppBadge v-if="sku" :label="sku" variant-class="bg-info bg-opacity-75" />
    <AppBadge v-if="price != null" :label="formattedPrice" variant-class="bg-success bg-opacity-75" />
  </span>
</template>
