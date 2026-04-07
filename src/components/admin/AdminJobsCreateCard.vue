<script setup lang="ts">
import AdminAccordionFormCard from '@/components/admin/AdminAccordionFormCard.vue'
import BaseInputField from '@/components/common/BaseInputField.vue'
import BaseSelectField from '@/components/common/BaseSelectField.vue'
import type { JobFormInput } from '@/types/adminJobs'

const props = defineProps<{
  open: boolean
  form: JobFormInput
  loading: boolean
  foremanOptions: readonly { value: string; label: string }[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:form': [value: JobFormInput]
  submit: []
  cancel: []
}>()

function updateField<K extends keyof JobFormInput>(field: K, value: JobFormInput[K]) {
  emit('update:form', {
    ...props.form,
    [field]: value,
  })
}
</script>

<template>
  <AdminAccordionFormCard
    :open="open"
    title="Create Job"
    subtitle="Add a new job with code for tracking"
    :loading="loading"
    :submit-disabled="!form.name"
    submit-label="Create Job"
    @update:open="(value) => emit('update:open', value)"
    @submit="emit('submit')"
    @cancel="emit('cancel')"
  >
    <div class="col-md-2">
      <BaseInputField
        :model-value="form.code"
        label="Job #"
        label-class="small"
        placeholder="4197"
        @update:model-value="updateField('code', $event)"
      />
    </div>
    <div class="col-md-4">
      <BaseInputField
        :model-value="form.name"
        label="Job Name"
        label-class="small"
        placeholder="Project Name"
        required
        @update:model-value="updateField('name', $event)"
      />
    </div>
    <div class="col-md-4">
      <BaseInputField
        :model-value="form.projectManager"
        label="Project Manager"
        label-class="small"
        placeholder="Brian"
        @update:model-value="updateField('projectManager', $event)"
      />
    </div>
    <div class="col-md-4">
      <BaseSelectField
        :model-value="form.foreman"
        label="Foreman"
        label-class="small"
        :options="[...foremanOptions]"
        include-empty-option
        empty-option-label="-- Select Foreman --"
        @update:model-value="updateField('foreman', String($event))"
      />
    </div>
    <div class="col-md-3">
      <BaseInputField
        :model-value="form.gc"
        label="GC"
        label-class="small"
        placeholder="Turner"
        @update:model-value="updateField('gc', $event)"
      />
    </div>
    <div class="col-md-9">
      <BaseInputField
        :model-value="form.jobAddress"
        label="Job Address"
        label-class="small"
        placeholder="12605 E 16th ave aurora"
        @update:model-value="updateField('jobAddress', $event)"
      />
    </div>
    <div class="col-md-2">
      <BaseInputField
        :model-value="form.startDate"
        type="date"
        label="Start"
        label-class="small"
        @update:model-value="updateField('startDate', $event)"
      />
    </div>
    <div class="col-md-2">
      <BaseInputField
        :model-value="form.finishDate"
        type="date"
        label="Finish"
        label-class="small"
        @update:model-value="updateField('finishDate', $event)"
      />
    </div>
    <div class="col-md-2">
      <BaseInputField
        :model-value="form.taxExempt"
        label="Tax Exempt"
        label-class="small"
        placeholder="no / TE"
        @update:model-value="updateField('taxExempt', $event)"
      />
    </div>
    <div class="col-md-2">
      <BaseInputField
        :model-value="form.certified"
        label="Certified"
        label-class="small"
        placeholder="no"
        @update:model-value="updateField('certified', $event)"
      />
    </div>
    <div class="col-md-2">
      <BaseInputField
        :model-value="form.cip"
        label="CIP"
        label-class="small"
        placeholder="2445"
        @update:model-value="updateField('cip', $event)"
      />
    </div>
    <div class="col-md-2">
      <BaseInputField
        :model-value="form.kjic"
        label="KJIC"
        label-class="small"
        placeholder="Yes/No"
        @update:model-value="updateField('kjic', $event)"
      />
    </div>
  </AdminAccordionFormCard>
</template>
