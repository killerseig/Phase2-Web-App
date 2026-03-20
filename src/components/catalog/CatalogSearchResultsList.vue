<script setup lang="ts">
import { computed } from 'vue'
import CatalogMetadataBadges from '@/components/catalog/CatalogMetadataBadges.vue'
import type { CatalogSearchResult } from '@/composables/useCatalogSearchResults'

const props = defineProps<{
  results: CatalogSearchResult[]
  totalResultCount: number
  hasMoreResults: boolean
}>()

const emit = defineEmits<{
  (e: 'reveal', result: CatalogSearchResult): void
}>()

function iconClass(result: CatalogSearchResult): string {
  if (result.kind === 'category') return 'bi bi-folder'
  return result.hasChildren ? 'bi bi-folder2' : 'bi bi-file-text'
}

function pathText(result: CatalogSearchResult): string {
  return result.breadcrumbLabel || 'Top level'
}

const summaryText = computed(() => {
  const count = `${props.totalResultCount} result${props.totalResultCount === 1 ? '' : 's'}`
  return props.hasMoreResults ? `${count}, showing the first ${props.results.length}` : count
})
</script>

<template>
  <div class="catalog-search-results">
    <div class="search-summary small text-muted">{{ summaryText }}</div>

    <div class="app-catalog-tree">
      <div v-for="result in props.results" :key="result.nodeId" class="tree-node accordion-item">
        <div class="node-header" @click="emit('reveal', result)">
          <button
            type="button"
            class="accordion-button result-main"
            :class="result.hasChildren ? 'has-children collapsed' : 'not-expandable'"
            @click="emit('reveal', result)"
          >
            <i class="me-2 node-item-icon" :class="iconClass(result)"></i>
            <span class="item-label result-label" :class="{ 'is-archived': !result.active }">
              <span class="result-line">
                {{ result.label }}
                <CatalogMetadataBadges
                  :archived="!result.active"
                  :sku="result.kind === 'item' ? result.sku : undefined"
                  :price="result.kind === 'item' ? result.price : undefined"
                />
                <span class="result-path">{{ pathText(result) }}</span>
              </span>
            </span>
          </button>

          <div class="node-actions">
            <slot name="actions" :result="result">
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary result-action-btn"
                @click="emit('reveal', result)"
                title="Reveal in tree"
                aria-label="Reveal in tree"
              >
                <i class="bi bi-arrow-return-right"></i>
              </button>
            </slot>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;
@use '@/styles/_catalogTreeRows.scss';

.catalog-search-results {
  background-color: transparent;
}

.search-summary {
  padding: 0.5rem 0.75rem;
}

.result-label {
  min-width: 0;
  user-select: none;
}

.result-line {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
  overflow: hidden;
}

.result-path {
  color: $text-muted;
  font-size: 0.95em;
  white-space: nowrap;
}

.result-main {
  cursor: pointer;
}

.result-action-btn {
  width: 2.5rem;
  height: 2.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
</style>
