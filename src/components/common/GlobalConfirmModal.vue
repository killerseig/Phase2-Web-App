<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useConfirmStore } from '@/stores/confirm'

const confirmStore = useConfirmStore()

const confirmButtonClass = computed(() => {
  switch (confirmStore.options.variant) {
    case 'danger':
      return 'btn btn-danger'
    case 'warning':
      return 'btn btn-warning'
    default:
      return 'btn btn-primary'
  }
})

const handleBackdropClick = (event: MouseEvent) => {
  if (event.target === event.currentTarget) {
    confirmStore.cancel()
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && confirmStore.isOpen) {
    confirmStore.cancel()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div
    v-if="confirmStore.isOpen"
    class="modal d-block bg-dark bg-opacity-50"
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    @click="handleBackdropClick"
  >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ confirmStore.options.title }}</h5>
          <button type="button" class="btn-close" aria-label="Close" @click="confirmStore.cancel"></button>
        </div>
        <div class="modal-body">
          <p class="mb-0">{{ confirmStore.options.message }}</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="confirmStore.cancel">
            {{ confirmStore.options.cancelText }}
          </button>
          <button type="button" :class="confirmButtonClass" @click="confirmStore.confirm">
            {{ confirmStore.options.confirmText }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
