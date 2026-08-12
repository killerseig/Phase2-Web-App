<script setup lang="ts">
import ConfirmDialog from '@/components/ConfirmDialog.vue'

defineProps<{
  busy: boolean
  deleteDraftOpen: boolean
  removeItemMessage: string
  removeItemOpen: boolean
  submitOpen: boolean
}>()

const emit = defineEmits<{
  confirmDeleteDraft: []
  confirmRemoveItem: []
  confirmSubmitOrder: []
  'update:deleteDraftOpen': [value: boolean]
  'update:removeItemOpen': [value: boolean]
  'update:submitOpen': [value: boolean]
}>()
</script>

<template>
  <ConfirmDialog
    :open="removeItemOpen"
    title="Remove item?"
    :message="removeItemMessage"
    confirm-label="Remove Item"
    destructive
    :busy="busy"
    @update:open="emit('update:removeItemOpen', $event)"
    @confirm="emit('confirmRemoveItem')"
  />

  <ConfirmDialog
    :open="deleteDraftOpen"
    title="Delete draft?"
    message="Delete this draft shop order?"
    confirm-label="Delete Draft"
    destructive
    :busy="busy"
    @update:open="emit('update:deleteDraftOpen', $event)"
    @confirm="emit('confirmDeleteDraft')"
  />

  <ConfirmDialog
    :open="submitOpen"
    title="Submit shop order?"
    message="Submit this shop order? The order will become read-only."
    confirm-label="Submit Order"
    :busy="busy"
    @update:open="emit('update:submitOpen', $event)"
    @confirm="emit('confirmSubmitOrder')"
  />
</template>
