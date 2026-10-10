<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppShell from '@/layouts/AppShell.vue'
import SdsExplorerModule from '@/components/dashboard/SdsExplorerModule.vue'
import { loadSds, sdsErrorMessage } from '@/services/sds'
import type { ExplorerFolder } from '@/features/sds/types'
const categories = ['SDS', 'Safety', 'AHA'] as const
const category = ref<typeof categories[number]>('SDS'), folders = ref<ExplorerFolder[]>([]), loading = ref(true), error = ref('')
const roots = computed(() => folders.value.filter(folder => !folder.parentId && folder.name.trim().toLowerCase() === category.value.toLowerCase()))
async function load() {
  loading.value = true; error.value = ''
  try { folders.value = (await loadSds('', true)).folders }
  catch (caught) { error.value = sdsErrorMessage(caught) }
  finally { loading.value = false }
}
onMounted(() => { void load() })
</script>
<template><AppShell><main class="company-library">
  <h1>Company Library</h1><nav aria-label="Library categories"><button v-for="item in categories" :key="item" :aria-pressed="category === item" @click="category = item">{{ item }}</button></nav>
  <p>Existing document read, upload and edit permissions apply.</p>
  <p v-if="loading" role="status">Loading library categories.</p>
  <p v-else-if="error" role="alert">{{ error }} <button @click="load">Retry</button></p>
  <SdsExplorerModule v-else-if="category === 'SDS'" expanded title="SDS" />
  <template v-else><p v-if="!roots.length">No {{ category }} category folder is configured. Admin can organize approved files using the existing Documents folder controls.</p>
    <SdsExplorerModule v-for="folder in roots" :key="folder.id" expanded :title="folder.name" :initial-folder-id="folder.id" />
  </template>
</main></AppShell></template>
<style scoped>.company-library { padding: 1rem; } nav { display: flex; gap: .5rem; } a { display: block; padding: .5rem 0; }</style>
