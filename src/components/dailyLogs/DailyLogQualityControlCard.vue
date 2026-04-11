<script setup lang="ts">
import { computed } from 'vue'
import AttachmentGallery from '@/components/common/AttachmentGallery.vue'
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import BaseFileUploadField from '@/components/common/BaseFileUploadField.vue'
import BaseInputField from '@/components/common/BaseInputField.vue'
import DailyLogTextField from '@/components/dailyLogs/DailyLogTextField.vue'
import type { Attachment } from '@/types/documents'

const props = defineProps<{
  attachments: Attachment[] | undefined
  canEdit: boolean
  uploading: boolean
  fileName: string
  qcPhotoDescription: string
  qcAssignedTo: string
  qcAreasInspected: string
  qcIssuesIdentified: string
  qcIssuesResolved: string
}>()

const emit = defineEmits<{
  (e: 'update:qcAssignedTo', value: string): void
  (e: 'update:qcAreasInspected', value: string): void
  (e: 'update:qcIssuesIdentified', value: string): void
  (e: 'update:qcIssuesResolved', value: string): void
  (e: 'update:qcPhotoDescription', value: string): void
  (e: 'upload', event: Event): void
  (e: 'delete-attachment', path: string): void
}>()

const qcAttachments = computed(() => (props.attachments || []).filter((attachment) => attachment.type === 'qc'))

function handleUpload(event: Event) {
  emit('upload', event)
}

function deleteAttachment(path?: string) {
  if (!path) return
  emit('delete-attachment', path)
}
</script>

<template>
  <AppSectionCard title="Quality Control" icon="bi bi-clipboard-check" class="mb-4">
      <div class="row g-3">
        <div class="col-12">
          <DailyLogTextField
            label="Who is assigned to do QC?"
            :rows="2"
            :model-value="qcAssignedTo"
            :disabled="!canEdit"
            @update:model-value="emit('update:qcAssignedTo', $event)"
          />
        </div>
        <div class="col-12">
          <DailyLogTextField
            label="What areas were inspected?"
            :rows="3"
            :model-value="qcAreasInspected"
            :disabled="!canEdit"
            @update:model-value="emit('update:qcAreasInspected', $event)"
          />
        </div>
        <div class="col-12">
          <DailyLogTextField
            label="What issues were identified?"
            :rows="3"
            :model-value="qcIssuesIdentified"
            :disabled="!canEdit"
            @update:model-value="emit('update:qcIssuesIdentified', $event)"
          />
        </div>
        <div class="col-12">
          <DailyLogTextField
            label="What was done to fix the issues?"
            :rows="3"
            :model-value="qcIssuesResolved"
            :disabled="!canEdit"
            @update:model-value="emit('update:qcIssuesResolved', $event)"
          />
        </div>
        <div class="col-12">
          <BaseInputField
            :model-value="qcPhotoDescription"
            label="QC Photo Description"
            placeholder="Describe what the QC photo shows"
            wrapper-class="mb-3"
            :disabled="!canEdit || uploading"
            @update:model-value="emit('update:qcPhotoDescription', $event)"
          />

          <BaseFileUploadField
            label="QC Photos"
            icon="bi bi-camera"
            accept="image/*"
            multiple
            wrapper-class="mb-0"
            :helper-text="qcPhotoDescription.trim() ? `${fileName} | Description ready` : `${fileName} | Description required before upload`"
            :disabled="!canEdit || uploading"
            @change="handleUpload"
          />

          <AttachmentGallery
            class="mt-2"
            :attachments="qcAttachments"
            :remove-disabled="!canEdit || uploading"
            :min-column-width="220"
            @remove="deleteAttachment"
          />
        </div>
      </div>
  </AppSectionCard>
</template>
