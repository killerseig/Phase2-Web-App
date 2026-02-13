<script setup lang="ts">
const props = defineProps<{
  recipients: string[]
  newEmail: string
  saving: boolean
}>()

const emit = defineEmits<{
  (e: 'add'): void
  (e: 'remove', email: string): void
  (e: 'update:newEmail', value: string): void
}>()
</script>

<template>
  <div class="card mb-4">
    <div class="card-header bg-light"><h5 class="mb-0"><i class="bi bi-envelope me-2"></i>Email Recipients</h5></div>
    <div class="card-body">
      <div class="mb-3">
        <input
          type="email"
          class="form-control mb-2"
          :value="newEmail"
          placeholder="Enter email"
          :disabled="saving"
          @input="emit('update:newEmail', ($event.target as HTMLInputElement).value)"
        />
        <button @click="emit('add')" :disabled="saving" class="btn btn-primary w-100 btn-sm">
          <i class="bi bi-plus me-1"></i>Add
        </button>
      </div>
      <div v-if="recipients.length" class="list-group">
        <div
          v-for="email in recipients"
          :key="email"
          class="list-group-item d-flex justify-content-between align-items-center"
        >
          <small>{{ email }}</small>
          <button @click="emit('remove', email)" :disabled="saving" class="btn btn-outline-danger btn-sm">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
      <div v-else class="text-muted small text-center py-3">No recipients yet</div>
    </div>
  </div>
</template>
