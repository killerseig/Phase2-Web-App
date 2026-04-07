<script setup lang="ts">
import { computed } from 'vue'

type AttachmentPreview = {
  name?: string
  path?: string
  url: string
}

const props = withDefaults(defineProps<{
  attachments: AttachmentPreview[]
  removable?: boolean
  removeDisabled?: boolean
  removeLabel?: string
  minColumnWidth?: number
}>(), {
  removable: true,
  removeDisabled: false,
  removeLabel: 'Remove',
  minColumnWidth: 240,
})

const emit = defineEmits<{
  remove: [path: string]
}>()

const gridStyle = computed(() => ({
  '--app-attachment-min-width': `${props.minColumnWidth}px`,
}))

function handleRemove(path?: string) {
  if (!path) return
  emit('remove', path)
}
</script>

<template>
  <div
    v-if="attachments.length"
    class="app-attachment-grid"
    :style="gridStyle"
  >
    <div
      v-for="attachment in attachments"
      :key="attachment.path ?? attachment.url"
      class="app-attachment-card"
    >
      <img
        :src="attachment.url"
        :alt="attachment.name || 'Attachment preview'"
        class="app-attachment-image"
      />

      <button
        v-if="removable"
        type="button"
        class="btn btn-sm btn-outline-secondary w-100"
        :disabled="removeDisabled || !attachment.path"
        @click="handleRemove(attachment.path)"
      >
        <i class="bi bi-trash me-1"></i>{{ removeLabel }}
      </button>
    </div>
  </div>
</template>
