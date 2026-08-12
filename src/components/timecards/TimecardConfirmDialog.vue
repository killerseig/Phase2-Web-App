<script setup lang="ts">
import ConfirmDialog from '@/components/ConfirmDialog.vue'

defineProps<{
  busy: boolean
  confirmLabel: string
  destructive: boolean
  message: string
  open: boolean
  title: string
}>()

const emit = defineEmits<{
  confirm: []
  updateOpen: [value: boolean]
}>()
</script>

<template>
  <ConfirmDialog
    :open="open"
    :title="title"
    :message="message"
    :confirm-label="confirmLabel"
    :destructive="destructive"
    :busy="busy"
    @update:open="emit('updateOpen', $event)"
    @confirm="emit('confirm')"
  />
</template>
