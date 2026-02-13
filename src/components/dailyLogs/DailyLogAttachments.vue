<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DailyLogAttachment } from '@/types'

type AttachmentWithPath = DailyLogAttachment & { path?: string }

const props = defineProps<{
  attachments: DailyLogAttachment[] | undefined
  canEdit: boolean
  uploading: boolean
  photoFileName: string
  ptpFileName: string
}>()

const localPhotoName = ref('')
const localPtpName = ref('')

const photoDisplay = computed(() => {
  const fallback = photos.value.length ? `${photos.value.length} uploaded` : 'No file selected'
  return localPhotoName.value || props.photoFileName || fallback
})

const ptpDisplay = computed(() => {
  const fallback = ptpPhotos.value.length ? `${ptpPhotos.value.length} uploaded` : 'No file selected'
  return localPtpName.value || props.ptpFileName || fallback
})

const emit = defineEmits<{
  (e: 'upload', payload: { event: Event; type: 'photo' | 'ptp' }): void
  (e: 'delete', path: string): void
}>()

const photos = computed(() => ((props.attachments || []) as AttachmentWithPath[]).filter((a) => a.type !== 'ptp'))
const ptpPhotos = computed(() => ((props.attachments || []) as AttachmentWithPath[]).filter((a) => a.type === 'ptp'))

const handleChange = (type: 'photo' | 'ptp', event: Event) => {
  const target = event.target as HTMLInputElement | null
  const files = target?.files
  const label = files?.length
    ? files.length === 1
      ? files[0].name
      : `${files.length} files`
    : ''

  if (type === 'photo') {
    localPhotoName.value = label
  } else {
    localPtpName.value = label
  }

  emit('upload', { event, type })
}
</script>

<template>
  <div class="card mb-4">
    <div class="card-header attachment-header"><h5 class="mb-0"><i class="bi bi-camera me-2"></i>Attachments</h5></div>
    <div class="card-body">
      <div class="mb-3">
        <label class="form-label d-flex align-items-center gap-2">
          <i class="bi bi-image"></i>
          <span>Photos</span>
        </label>
        <input
          class="form-control form-control-sm"
          type="file"
          accept="image/*"
          multiple
          @change="(e) => handleChange('photo', e)"
          :disabled="!canEdit || uploading"
        />
        <div class="form-text">{{ photoDisplay }}</div>

        <div v-if="photos.length" class="thumb-grid mt-2">
          <div v-for="att in photos" :key="att.path" class="thumb-card">
            <img :src="att.url" class="thumb-image" />
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary w-100"
              @click="emit('delete', att.path)"
              :disabled="uploading"
            >
              <i class="bi bi-trash me-1"></i>Remove
            </button>
          </div>
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label d-flex align-items-center gap-2">
          <i class="bi bi-shield-check"></i>
          <span>PTP Photos</span>
        </label>
        <input
          class="form-control form-control-sm"
          type="file"
          accept="image/*"
          multiple
          @change="(e) => handleChange('ptp', e)"
          :disabled="!canEdit || uploading"
        />
        <div class="form-text">{{ ptpDisplay }}</div>

        <div v-if="ptpPhotos.length" class="thumb-grid mt-2">
          <div v-for="att in ptpPhotos" :key="att.path" class="thumb-card">
            <img :src="att.url" class="thumb-image" />
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary w-100"
              @click="emit('delete', att.path)"
              :disabled="uploading"
            >
              <i class="bi bi-trash me-1"></i>Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.attachment-header {
  background: $surface-2 !important;
  border-bottom: 1px solid rgba($border-color, 0.5);
  color: $body-color;
}

.attachment-header h5 {
  color: $body-color;
}

.form-control[type="file"]::file-selector-button,
.form-control[type="file"]::-webkit-file-upload-button {
  background: $surface-3 !important;
  color: $body-color !important;
  border: none !important;
  border-right: 1px solid $border-color !important;
  padding: 0.375rem 0.75rem !important;
  margin-right: 0.75rem !important;
  cursor: pointer !important;
}

.form-control[type="file"]::file-selector-button:hover,
.form-control[type="file"]::-webkit-file-upload-button:hover {
  background: lighten($surface-3, 3%) !important;
}

.form-control[type="file"]::-moz-file-upload-button {
  background: $surface-3 !important;
  color: $body-color !important;
  border: none !important;
  border-right: 1px solid $border-color !important;
  padding: 0.375rem 0.75rem !important;
  margin-right: 0.75rem !important;
  cursor: pointer !important;
}

.form-control[type="file"]::-moz-file-upload-button:hover {
  background: lighten($surface-3, 3%) !important;
}

.thumb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
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

.thumb-card .btn {
  border-radius: 0;
}
</style>
