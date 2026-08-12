<script setup lang="ts">
import ConfirmDialog from '@/components/ConfirmDialog.vue'

defineProps<{
  archiveBusy: boolean
  archiveConfirmLabel: string
  archiveMessage: string
  archiveOpen: boolean
  archiveTitle: string
  deleteBusy: boolean
  deleteMessage: string
  deleteOpen: boolean
}>()

const emit = defineEmits<{
  confirmArchive: []
  confirmDelete: []
  updateArchiveOpen: [value: boolean]
  updateDeleteOpen: [value: boolean]
}>()
</script>

<template>
  <ConfirmDialog
    :open="archiveOpen"
    :title="archiveTitle"
    :message="archiveMessage"
    :confirm-label="archiveConfirmLabel"
    :busy="archiveBusy"
    @update:open="emit('updateArchiveOpen', $event)"
    @confirm="emit('confirmArchive')"
  />

  <ConfirmDialog
    :open="deleteOpen"
    title="Delete job?"
    :message="deleteMessage"
    confirm-label="Delete Job"
    destructive
    :busy="deleteBusy"
    @update:open="emit('updateDeleteOpen', $event)"
    @confirm="emit('confirmDelete')"
  />
</template>
