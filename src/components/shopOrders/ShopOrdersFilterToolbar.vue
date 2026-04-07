<script setup lang="ts">
import AppSearchToolbar from '@/components/common/AppSearchToolbar.vue'
import BaseSelectField from '@/components/common/BaseSelectField.vue'

defineProps<{
  search: string
  statusFilter: string
  statusOptions: readonly { value: string; label: string }[]
}>()

const emit = defineEmits<{
  'update:search': [value: string]
  'update:statusFilter': [value: string]
}>()
</script>

<template>
  <AppSearchToolbar
    :model-value="search"
    class="mb-4"
    placeholder="Search orders..."
    search-col-class="col-md-6"
    @update:model-value="emit('update:search', $event)"
  >
    <div class="col-md-6">
      <BaseSelectField
        :model-value="statusFilter"
        :options="statusOptions"
        wrapper-class="mb-0"
        @update:model-value="emit('update:statusFilter', String($event))"
      />
    </div>
  </AppSearchToolbar>
</template>
