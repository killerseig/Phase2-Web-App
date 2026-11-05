<script setup lang="ts">
import AppLoadingIndicator from '@/components/common/AppLoadingIndicator.vue'
import AppButton from '@/components/common/AppButton.vue'
import { useAuthStore } from '@/stores/auth'
import type { SdsSheet } from '@/features/sds/types'
withDefaults(defineProps<{ loading: boolean; error: string; notice: string; packages: SdsSheet[]; selected: string; showEmptyState?: boolean; showLoading?: boolean }>(), { showEmptyState: true, showLoading: true })
const emit = defineEmits<{ retry: []; select: [id: string] }>()
const auth = useAuthStore()
</script>
<template>
  <Transition name="reference-loading"><AppLoadingIndicator v-if="loading && showLoading" class="reference-loading" label="Loading references…" /></Transition>
  <p v-if="error" role="alert">{{ error }} <AppButton @click="emit('retry')">Retry references</AppButton></p>
  <p v-if="notice" role="status">{{ notice }}</p>
  <label v-if="packages.length > 1 || (packages.length && !loading && notice)">Reference source
    <select :value="selected" @change="emit('select', ($event.target as HTMLSelectElement).value)">
      <option value="">Choose an uploaded reference source</option><option v-for="item in packages" :key="item.id" :value="item.id">{{ item.name }}</option>
    </select>
  </label>
  <p v-if="showEmptyState && !loading && !error && !notice && !packages.length">No supplied references have been uploaded. <template v-if="auth.rawRole === 'admin'">Use the existing library Upload document control for the prepared Phase2 intranet content.txt.</template><template v-else>An Admin manages reference uploads.</template> Documents omitted from the ZIP remain unavailable.</p>
</template>

<style scoped>
.reference-loading { min-height: 6rem; }
.reference-loading-enter-active, .reference-loading-leave-active { transition: opacity 180ms ease-out; }
.reference-loading-enter-from, .reference-loading-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .reference-loading-enter-active, .reference-loading-leave-active { transition: none; } }
</style>
