<script setup lang="ts">
import AppField from '@/components/common/AppField.vue'
import AppSelect from '@/components/common/AppSelect.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'
import type { JobType } from '@/types/domain'
import { formatJobTypeLabel } from '@/types/domain'

interface JobDetailsFormModel {
  name: string
  code: string
  type: JobType | string
  gc: string
  jobAddress: string
  startDate: string
  finishDate: string
  productionBurden: string
}

type JobDetailsField = keyof JobDetailsFormModel

defineProps<{
  model: JobDetailsFormModel
  jobTypeOptions: string[]
  testIdPrefix?: string
}>()

const emit = defineEmits<{
  updateField: [field: JobDetailsField, value: string]
}>()

function handleTextInput(field: JobDetailsField, value: string) {
  emit('updateField', field, value)
}

function handleSelectInput(field: JobDetailsField, value: string) {
  emit('updateField', field, value)
}
</script>

<template>
  <div class="jobs-form__grid">
    <AppField label="Job Number">
      <AppTextInput
        :model-value="model.code"
        :data-testid="testIdPrefix ? `${testIdPrefix}-code` : undefined"
        type="text"
        autocomplete="off"
        @update:model-value="handleTextInput('code', $event)"
      />
    </AppField>
    <AppField label="Job Type">
      <AppSelect
        :model-value="model.type"
        @update:model-value="handleSelectInput('type', $event)"
      >
        <option v-for="option in jobTypeOptions" :key="option" :value="option">
          {{ formatJobTypeLabel(option) }}
        </option>
      </AppSelect>
    </AppField>
    <AppField class="jobs-form__field--full" label="Job Name">
      <AppTextInput
        :model-value="model.name"
        :data-testid="testIdPrefix ? `${testIdPrefix}-name` : undefined"
        type="text"
        autocomplete="off"
        @update:model-value="handleTextInput('name', $event)"
      />
    </AppField>
    <AppField label="GC">
      <AppTextInput
        :model-value="model.gc"
        :data-testid="testIdPrefix ? `${testIdPrefix}-gc` : undefined"
        type="text"
        list="job-gc-options"
        autocomplete="off"
        @update:model-value="handleTextInput('gc', $event)"
      />
    </AppField>
    <AppField label="Burden">
      <AppTextInput
        :model-value="model.productionBurden"
        type="number"
        min="0"
        step="0.01"
        inputmode="decimal"
        @update:model-value="handleTextInput('productionBurden', $event)"
      />
    </AppField>
    <AppField label="Start Date">
      <AppTextInput
        :model-value="model.startDate"
        type="date"
        @update:model-value="handleTextInput('startDate', $event)"
      />
    </AppField>
    <AppField label="End Date">
      <AppTextInput
        :model-value="model.finishDate"
        type="date"
        @update:model-value="handleTextInput('finishDate', $event)"
      />
    </AppField>
    <AppField class="jobs-form__field--full" label="Job Address">
      <AppTextInput
        :model-value="model.jobAddress"
        :data-testid="testIdPrefix ? `${testIdPrefix}-address` : undefined"
        type="text"
        autocomplete="street-address"
        @update:model-value="handleTextInput('jobAddress', $event)"
      />
    </AppField>
  </div>
</template>

<style scoped>
.jobs-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.jobs-form__field--full {
  grid-column: 1 / -1;
}

.app-field .app-select {
  --app-select-min-height: 2.8rem;
  --app-select-padding-x: 0.9rem;
  --app-select-background: rgba(255, 255, 255, 0.045);
}

@media (max-width: 760px) {
  .jobs-form__grid {
    grid-template-columns: 1fr;
  }
}
</style>
