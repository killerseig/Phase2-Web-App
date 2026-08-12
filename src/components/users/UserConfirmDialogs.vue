<script setup lang="ts">
import ConfirmDialog from '@/components/ConfirmDialog.vue'

defineProps<{
  deleteBusy: boolean
  deleteMessage: string
  deleteOpen: boolean
}>()

const emit = defineEmits<{
  confirmDelete: []
  updateDeleteOpen: [value: boolean]
}>()
</script>

<template>
  <ConfirmDialog
    :open="deleteOpen"
    title="Delete user?"
    :message="deleteMessage"
    confirm-label="Delete User"
    destructive
    :busy="deleteBusy"
    @update:open="emit('updateDeleteOpen', $event)"
    @confirm="emit('confirmDelete')"
  />
</template>
