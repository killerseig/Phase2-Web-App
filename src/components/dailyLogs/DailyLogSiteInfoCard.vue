<script setup lang="ts">
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import BaseInputField from '@/components/common/BaseInputField.vue'

defineProps<{
  projectName: string
  jobNumber: string
  projectManager: string
  foreman: string
  generalContractor: string
  address: string
}>()
</script>

<template>
  <AppSectionCard class="mb-4" title="Job Information" icon="bi bi-briefcase">
    <div class="row g-3">
      <div class="col-12 col-md-6">
        <BaseInputField
          :model-value="projectName"
          label="Project Name"
          disabled
        />
      </div>
      <div class="col-12 col-md-6">
        <BaseInputField
          :model-value="jobNumber"
          label="Job Number"
          disabled
        />
      </div>
      <div class="col-12 col-md-6">
        <BaseInputField
          :model-value="projectManager"
          label="Project Manager"
          disabled
        />
      </div>
      <div class="col-12 col-md-6">
        <BaseInputField
          :model-value="foreman"
          label="Foreman"
          disabled
        />
      </div>
      <div class="col-12 col-md-6">
        <BaseInputField
          :model-value="generalContractor"
          label="General Contractor"
          disabled
        />
      </div>
      <div class="col-12 col-md-6">
        <BaseInputField
          :model-value="address"
          label="Job Address"
          disabled
        />
      </div>
    </div>
  </AppSectionCard>
</template>
