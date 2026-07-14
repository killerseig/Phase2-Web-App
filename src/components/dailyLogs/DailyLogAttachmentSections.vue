<script setup lang="ts">
import DailyLogAttachmentCard from '@/components/dailyLogs/DailyLogAttachmentCard.vue'
import type { DailyLogAttachmentRecord } from '@/types/domain'

type AttachmentUploadHandler = (entries: Array<{ file: File; description: string }>) => Promise<void>

const props = defineProps<{
  disabled: boolean
  photoAttachments: DailyLogAttachmentRecord[]
  photoBusy: boolean
  ptpAttachments: DailyLogAttachmentRecord[]
  ptpBusy: boolean
  uploadPhoto: AttachmentUploadHandler
  uploadPtp: AttachmentUploadHandler
}>()

const emit = defineEmits<{
  remove: [path: string]
  updateDescription: [payload: { path: string; description: string }]
}>()
</script>

<template>
  <DailyLogAttachmentCard
    title="Photos"
    choose-label="Choose Photos"
    description-label="Description"
    empty-label="Drag and drop photos here to upload."
    helper-text="Choose one or more photos. Photos upload right away. Click Save Draft after editing descriptions."
    :attachments="props.photoAttachments"
    :disabled="props.disabled"
    :busy="props.photoBusy"
    :upload-handler="props.uploadPhoto"
    @update-description="emit('updateDescription', $event)"
    @remove="emit('remove', $event)"
  />

  <DailyLogAttachmentCard
    title="PTP Photos"
    choose-label="Choose PTP Photos"
    description-label="Note"
    empty-label="Drag and drop PTP photos here to upload."
    helper-text="Choose one or more PTP photos. Photos upload right away. Click Save Draft after editing notes."
    :attachments="props.ptpAttachments"
    :disabled="props.disabled"
    :busy="props.ptpBusy"
    :upload-handler="props.uploadPtp"
    @update-description="emit('updateDescription', $event)"
    @remove="emit('remove', $event)"
  />
</template>
