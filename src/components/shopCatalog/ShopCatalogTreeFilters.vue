<script setup lang="ts">
import AppCheckbox from '@/components/common/AppCheckbox.vue'
import AppSearchInput from '@/components/common/AppSearchInput.vue'

defineProps<{
  search: string
  showArchived: boolean
}>()

const emit = defineEmits<{
  'update:search': [value: string]
  'update:show-archived': [value: boolean]
}>()

</script>

<template>
  <div class="shop-catalog-tree-filters">
    <div class="shop-catalog-tree-filters__search">
      <AppSearchInput
        :model-value="search"
        class="shop-catalog-tree-filters__input"
        data-testid="shop-catalog-search"
        placeholder="Find folder"
        @update:model-value="emit('update:search', $event)"
      />
    </div>

    <label class="shop-catalog-tree-filters__toggle-row">
      <AppCheckbox
        :model-value="showArchived"
        @update:model-value="emit('update:show-archived', $event)"
      />
      <span>Show Archived</span>
    </label>
  </div>
</template>

<style scoped>
.shop-catalog-tree-filters {
  display: grid;
  gap: 0.7rem;
}

.shop-catalog-tree-filters__input {
  --app-search-input-min-height: 2.55rem;
  --app-search-input-padding-x: 0.85rem;
  --app-search-input-background: rgba(255, 255, 255, 0.045);
}

.shop-catalog-tree-filters__toggle-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  padding: 0 0.2rem;
  color: var(--text-muted);
}

.shop-catalog-tree-filters__toggle-row span {
  font-size: 0.82rem;
  letter-spacing: 0.02em;
}

.shop-catalog-tree-filters__toggle-row input {
  margin-top: 0.1rem;
  accent-color: var(--accent-strong);
}
</style>
