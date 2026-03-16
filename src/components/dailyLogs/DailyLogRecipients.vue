<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  recipients: string[]
  globalRecipients?: string[]
  newEmail: string
  saving: boolean
}>()

const emit = defineEmits<{
  (e: 'add'): void
  (e: 'remove', email: string): void
  (e: 'update:newEmail', value: string): void
}>()

const uniqueGlobalRecipients = computed(() =>
  Array.from(new Set((props.globalRecipients ?? []).filter(Boolean)))
)
</script>

<template>
  <div class="card mb-4">
    <div class="card-header panel-header"><h5 class="mb-0"><i class="bi bi-envelope me-2"></i>Email Recipients</h5></div>
    <div class="card-body">
      <p class="text-muted small mb-2">Job-specific recipients</p>
      <div class="mb-3">
        <input
          type="email"
          class="form-control mb-2"
          :value="props.newEmail"
          placeholder="Enter email"
          :disabled="props.saving"
          @input="emit('update:newEmail', ($event.target as HTMLInputElement).value)"
        />
        <button @click="emit('add')" :disabled="props.saving" class="btn btn-primary w-100 btn-sm">
          <i class="bi bi-plus me-1"></i>Add
        </button>
      </div>
      <div v-if="props.recipients.length" class="list-group">
        <div
          v-for="email in props.recipients"
          :key="email"
          class="list-group-item d-flex justify-content-between align-items-center"
        >
          <small>{{ email }}</small>
          <button @click="emit('remove', email)" :disabled="props.saving" class="btn btn-outline-danger btn-sm">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
      <div v-else class="text-muted small text-center py-3">No job-specific recipients yet</div>

      <div v-if="uniqueGlobalRecipients.length" class="mt-3">
        <p class="text-muted small mb-2">Global defaults (read-only)</p>
        <div class="list-group">
          <div
            v-for="email in uniqueGlobalRecipients"
            :key="`global-${email}`"
            class="list-group-item d-flex justify-content-between align-items-center"
          >
            <small>{{ email }}</small>
            <span class="badge app-badge-pill app-badge-pill--sm text-bg-secondary">Global</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
