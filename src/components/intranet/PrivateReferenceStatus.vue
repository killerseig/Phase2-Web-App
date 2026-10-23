<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import type { SdsSheet } from '@/features/sds/types'
defineProps<{ loading: boolean; error: string; notice: string; packages: SdsSheet[]; selected: string }>()
const emit = defineEmits<{ retry: []; cancel: []; select: [id: string] }>()
const auth = useAuthStore()
</script>
<template>
  <p v-if="loading" role="status">Loading supplied references. <button type="button" @click="emit('cancel')">Cancel loading</button></p>
  <p v-if="error" role="alert">{{ error }} <button type="button" @click="emit('retry')">Retry references</button></p>
  <p v-if="notice" role="status">{{ notice }}</p>
  <label v-if="packages.length > 1 || (packages.length && !loading && notice)">Reference source
    <select :value="selected" @change="emit('select', ($event.target as HTMLSelectElement).value)">
      <option value="">Choose an uploaded reference source</option><option v-for="item in packages" :key="item.id" :value="item.id">{{ item.name }}</option>
    </select>
  </label>
  <p v-if="!loading && !error && !notice && !packages.length">No supplied references have been uploaded. <template v-if="auth.rawRole === 'admin'">Use the existing library Upload document control for the prepared Phase2 intranet content.txt.</template><template v-else>An Admin manages reference uploads.</template> Documents omitted from the ZIP remain unavailable.</p>
</template>
