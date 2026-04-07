<script setup lang="ts">
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import DailyLogTextField from '@/components/dailyLogs/DailyLogTextField.vue'

export interface DailyLogTextSectionField {
  key: string
  label: string
  value: string
  rows?: number
  placeholder?: string
}

defineProps<{
  title: string
  icon: string
  fields: DailyLogTextSectionField[]
  canEdit: boolean
}>()

const emit = defineEmits<{
  'update-field': [payload: { key: string; value: string }]
}>()
</script>

<template>
  <AppSectionCard class="mb-4" :title="title" :icon="icon">
    <div class="row g-3">
      <div
        v-for="field in fields"
        :key="field.key"
        class="col-12"
      >
        <DailyLogTextField
          :label="field.label"
          :rows="field.rows ?? 3"
          :placeholder="field.placeholder"
          :model-value="field.value"
          :disabled="!canEdit"
          @update:model-value="(value) => emit('update-field', { key: field.key, value })"
        />
      </div>
    </div>
  </AppSectionCard>
</template>
