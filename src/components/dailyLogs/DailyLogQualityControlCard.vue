<script setup lang="ts">
import { computed } from 'vue'
import DailyLogTextField from '@/components/dailyLogs/DailyLogTextField.vue'
import type { Attachment } from '@/types/documents'

const props = defineProps<{
  attachments: Attachment[] | undefined
  canEdit: boolean
  uploading: boolean
  fileName: string
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
  <div class="card mb-4 app-section-card">
    <div class="card-header panel-header"><h5 class="mb-0"><i class="bi bi-clipboard-check me-2"></i>Quality Control</h5></div>
    <div class="card-body">
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
          <label class="form-label d-flex align-items-center gap-2">
            <i class="bi bi-camera"></i>
            <span>QC Photos</span>
          </label>
          <input
            class="form-control form-control-sm"
            type="file"
            accept="image/*"
            multiple
            :disabled="!canEdit || uploading"
            @change="handleUpload"
          />
          <div class="form-text">{{ fileName }}</div>

          <div v-if="qcAttachments.length" class="thumb-grid mt-2">
            <div v-for="attachment in qcAttachments" :key="attachment.path ?? attachment.url" class="thumb-card">
              <img :src="attachment.url" class="thumb-image" />
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary w-100"
                :disabled="!canEdit || uploading"
                @click="deleteAttachment(attachment.path)"
              >
                <i class="bi bi-trash me-1"></i>Remove
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.form-control[type='file'] {
  background-color: $surface-2;
  color: $body-color;
  border-color: $border-color;
}

.form-control[type='file']::file-selector-button {
  background-color: $surface-3;
  color: $body-color;
  border-color: $border-color;
}

.form-control[type='file']:hover::file-selector-button,
.form-control[type='file']:focus::file-selector-button {
  background-color: lighten($surface-3, 4%);
}

.thumb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.6rem;
}

.thumb-card {
  border: 1px solid $border-color;
  border-radius: 8px;
  overflow: hidden;
  background: $surface-2;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
}

.thumb-image {
  max-width: 300px;
  max-height: 200px;
  object-fit: contain;
  display: block;
  background: $surface-3;
  padding: 8px;
  flex-grow: 1;
  align-self: center;
}
</style>
