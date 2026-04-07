<script setup lang="ts">
import { computed, ref } from 'vue'
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import AttachmentGallery from '@/components/common/AttachmentGallery.vue'
import BaseFileUploadField from '@/components/common/BaseFileUploadField.vue'
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

const photos = computed(() => ((props.attachments || []) as AttachmentWithPath[]).filter((a) => a.type !== 'ptp' && a.type !== 'qc'))
const ptpPhotos = computed(() => ((props.attachments || []) as AttachmentWithPath[]).filter((a) => a.type === 'ptp'))

const handleChange = (type: 'photo' | 'ptp', event: Event) => {
  const target = event.target as HTMLInputElement | null
  const files = target?.files
  const firstFile = files?.[0]
  const label = files?.length
    ? files.length === 1 && firstFile
      ? firstFile.name
      : `${files.length} files`
    : ''

  if (type === 'photo') {
    localPhotoName.value = label
  } else {
    localPtpName.value = label
  }

  emit('upload', { event, type })
}

const emitDelete = (path?: string) => {
  if (!path) return
  emit('delete', path)
}
</script>

<template>
  <AppSectionCard title="Attachments" icon="bi bi-camera" class="mb-4">
    <BaseFileUploadField
      label="Photos"
      icon="bi bi-image"
      accept="image/*"
      multiple
      wrapper-class="mb-3"
      :helper-text="photoDisplay"
      :disabled="!canEdit || uploading"
      @change="(event) => handleChange('photo', event)"
    />

    <AttachmentGallery
      class="mt-2"
      :attachments="photos"
      :remove-disabled="!canEdit || uploading"
      :min-column-width="280"
      @remove="emitDelete"
    />

    <BaseFileUploadField
      label="PTP Photos"
      icon="bi bi-shield-check"
      accept="image/*"
      multiple
      wrapper-class="mb-3"
      :helper-text="ptpDisplay"
      :disabled="!canEdit || uploading"
      @change="(event) => handleChange('ptp', event)"
    />

    <AttachmentGallery
      class="mt-2"
      :attachments="ptpPhotos"
      :remove-disabled="!canEdit || uploading"
      :min-column-width="280"
      @remove="emitDelete"
    />
  </AppSectionCard>
</template>
