<script setup lang="ts">
import { computed } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
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

</script>

<template>
  <BaseModal
    :open="confirmStore.isOpen"
    :title="confirmStore.options.title"
    @close="confirmStore.cancel"
  >
    <p class="mb-0">{{ confirmStore.options.message }}</p>

    <template #footer>
      <button type="button" class="btn btn-secondary" @click="confirmStore.cancel">
        {{ confirmStore.options.cancelText }}
      </button>
      <button type="button" :class="confirmButtonClass" @click="confirmStore.confirm">
        {{ confirmStore.options.confirmText }}
      </button>
    </template>
  </BaseModal>
</template>
