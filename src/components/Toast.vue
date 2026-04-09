<script setup lang="ts">
import { useToast, type ToastType } from '@/composables/useToast'

const { toasts } = useToast()

function bgClass(type: ToastType) {
  switch (type) {
    case 'success': return 'bg-success'
    case 'error': return 'bg-danger'
    case 'warning': return 'bg-warning'
    default: return 'bg-info'
  }
}

function animationStyle(duration?: number) {
  if (!duration || duration <= 0) return undefined
  return { animationDuration: `${duration}ms` }
}
</script>

<template>
  <div class="position-fixed top-0 start-50 translate-middle-x p-3 toast-stack">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast show mb-2"
      :class="bgClass(toast.type)"
      :style="animationStyle(toast.duration)"
    >
      <div class="toast-body text-white">
        {{ toast.message }}
      </div>
    </div>
  </div>
</template>

