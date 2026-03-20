<script setup lang="ts">
import CatalogSearchResultsList from '@/components/catalog/CatalogSearchResultsList.vue'
import type { CatalogSearchResult } from '@/composables/useCatalogSearchResults'

const props = defineProps<{
  results: CatalogSearchResult[]
  totalResultCount: number
  hasMoreResults: boolean
}>()

const emit = defineEmits<{
  (e: 'reveal', result: CatalogSearchResult): void
}>()
</script>

<template>
  <CatalogSearchResultsList
    :results="props.results"
    :total-result-count="props.totalResultCount"
    :has-more-results="props.hasMoreResults"
    @reveal="(result) => emit('reveal', result)"
  />
</template>
