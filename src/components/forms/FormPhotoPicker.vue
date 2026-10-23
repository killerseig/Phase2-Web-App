<script setup lang="ts">
import { ref } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
defineOptions({ inheritAttrs: false })
defineProps<{ id: string; label: string; disabled?: boolean }>()
const emit = defineEmits<{ select: [files: File[]] }>()
const input = ref<HTMLInputElement>(), filenames = ref('')
function select(event: Event) {
  const element = event.target as HTMLInputElement, files = Array.from(element.files || [])
  if (!files.length) return
  filenames.value = files.map(file => file.name).join(', ')
  emit('select', files)
  element.value = ''
}
</script>
<template>
  <div class="form-photo-picker">
    <AppButton v-bind="$attrs" :id="id" class="form-photo-picker__choose" type="button" :aria-label="'Choose ' + label" :title="'Choose ' + label" :disabled="disabled" @click="input?.click()"><i class="pi pi-images" aria-hidden="true" /></AppButton>
    <span class="form-photo-picker__names" :title="filenames" aria-live="polite">{{ filenames || 'No files selected' }}</span>
    <input ref="input" :id="id + '-input'" :aria-label="label" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden :disabled="disabled" @change="select" />
  </div>
</template>
<style scoped>
.form-photo-picker { display: flex; align-items: center; flex-wrap: wrap; gap: .75rem; min-width: 0; }
.form-photo-picker__choose { width: 2.9rem; min-width: 2.9rem; padding: 0; }
.form-photo-picker__names { min-width: 0; overflow-wrap: anywhere; font-size: .9rem; color: var(--text-muted); }
</style>
