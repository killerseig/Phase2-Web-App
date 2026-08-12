<script setup lang="ts">
import ConfirmDialog from '@/components/ConfirmDialog.vue'

defineProps<{
  deleteDraftBusy: boolean
  deleteDraftOpen: boolean
}>()

const emit = defineEmits<{
  confirmDeleteDraft: []
  updateDeleteDraftOpen: [value: boolean]
}>()
</script>

<template>
  <ConfirmDialog
    :open="deleteDraftOpen"
    title="Delete daily log draft?"
    message="Delete this daily log draft and its attachments? This cannot be undone."
    confirm-label="Delete Draft"
    destructive
    :busy="deleteDraftBusy"
    @update:open="emit('updateDeleteDraftOpen', $event)"
    @confirm="emit('confirmDeleteDraft')"
  />
</template>
