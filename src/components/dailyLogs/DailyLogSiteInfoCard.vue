<script setup lang="ts">
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import BaseInputField from '@/components/common/BaseInputField.vue'

defineProps<{
  jobName: string
  jobSiteNumbers: string
  foremanOnSite: string
  siteForemanAssistant: string
  canEdit: boolean
}>()

const emit = defineEmits<{
  'update:jobSiteNumbers': [value: string]
  'update:foremanOnSite': [value: string]
  'update:siteForemanAssistant': [value: string]
}>()
</script>

<template>
  <AppSectionCard class="mb-4" title="Site Information" icon="bi bi-briefcase">
    <div class="row g-3">
      <div class="col-12">
        <BaseInputField
          :model-value="jobName"
          label="Project Name"
          disabled
        />
      </div>
      <div class="col-12">
        <BaseInputField
          :model-value="jobSiteNumbers"
          label="Job Site Numbers / Other Notes"
          :disabled="!canEdit"
          @update:model-value="(value) => emit('update:jobSiteNumbers', value)"
        />
      </div>
      <div class="col-12">
        <BaseInputField
          :model-value="foremanOnSite"
          label="Foreman on Site"
          :disabled="!canEdit"
          @update:model-value="(value) => emit('update:foremanOnSite', value)"
        />
      </div>
      <div class="col-12">
        <BaseInputField
          :model-value="siteForemanAssistant"
          label="Site Foreman Assistant"
          :disabled="!canEdit"
          @update:model-value="(value) => emit('update:siteForemanAssistant', value)"
        />
      </div>
    </div>
  </AppSectionCard>
</template>
