<script setup lang="ts">
import { computed, ref } from 'vue'

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration?: number
}

const toasts = ref<ToastMessage[]>([])
let nextId = 0

function show(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration = 5000) {
  const id = `toast-${nextId++}`
  const toast: ToastMessage = { id, message, type, duration }
  toasts.value.push(toast)

  if (duration > 0) {
    setTimeout(() => {
      remove(id)
    }, duration)
  }

  return id
}

function remove(id: string) {
  const idx = toasts.value.findIndex(t => t.id === id)
  if (idx !== -1) {
    toasts.value.splice(idx, 1)
  }
}

function bgClass(type: string) {
  switch (type) {
    case 'success': return 'bg-success'
    case 'error': return 'bg-danger'
    case 'warning': return 'bg-warning'
    default: return 'bg-info'
  }
}

defineExpose({ show, remove })
</script>

<template>
  <div class="position-fixed top-0 start-50 translate-middle-x p-3" style="z-index: 9999;">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast show mb-2"
      :class="bgClass(toast.type)"
    >
      <div class="toast-body text-white">
        {{ toast.message }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.toast {
  animation: fadeInOut 3s ease-in-out forwards;
  min-width: 300px;
}

@keyframes fadeInOut {
  0% {
    opacity: 0;
    transform: translateY(-20px);
  }
  10% {
    opacity: 1;
    transform: translateY(0);
  }
  90% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-20px);
  }
}
</style>
