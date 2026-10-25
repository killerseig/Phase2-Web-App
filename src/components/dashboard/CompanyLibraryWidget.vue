<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
import SdsExplorerModule from './SdsExplorerModule.vue'
import PrivateReferenceStatus from '@/components/intranet/PrivateReferenceStatus.vue'
import { usePrivateReferences } from '@/features/intranet/usePrivateReferences'
import { useAuthStore } from '@/stores/auth'
import { loadSds, sdsErrorMessage } from '@/services/sds'
import type { ExplorerFolder } from '@/features/sds/types'
withDefaults(defineProps<{ showHeading?: boolean }>(), { showHeading: true })
const categories = ['SDS', 'Safety', 'AHA'] as const
const auth = useAuthStore()
const { content, packages, selectedPackage, loading: referencesLoading, error: referencesError, notice, selectSource, reload, cancel } = usePrivateReferences()
const category = ref<typeof categories[number]>('SDS'), folders = ref<ExplorerFolder[]>([]), loading = ref(true), error = ref('')
const roots = computed(() => folders.value.filter(folder => !folder.parentId && folder.name.trim().toLowerCase() === category.value.toLowerCase()))
const activeFolder = computed(() => category.value === 'SDS' ? '' : roots.value[0]?.id || '')
async function load() {
  loading.value = true; error.value = ''
  try { folders.value = (await loadSds('', true)).folders }
  catch (caught) { error.value = sdsErrorMessage(caught) }
  finally { loading.value = false }
}
onMounted(() => { void load() })
</script>
<template>
  <section class="company-library-widget" aria-label="Company Library widget">
    <AppPaneHeader v-if="showHeading" title="Company Library" title-tag="h1" />
    <PrivateReferenceStatus :loading="referencesLoading" :error="referencesError" :notice="notice" :packages="packages" :selected="selectedPackage" :show-empty-state="false" @select="selectSource" @retry="reload" @cancel="cancel" />
    <p v-if="loading" role="status">Loading library categories.</p>
    <p v-else-if="error" role="alert">{{ error }} <button @click="load">Retry</button></p>
    <SdsExplorerModule v-else expanded :title="category" :initial-folder-id="activeFolder" :references="content" :reference-category="category">
      <template #navigation="{ disabled }">
        <div class="library-collections" role="navigation" aria-label="Library categories">
          <button v-for="item in categories" :key="item" type="button" :disabled="disabled" :aria-pressed="category === item" @click="category = item"><i class="pi pi-folder" aria-hidden="true" />{{ item }}</button>
        </div>
      </template>
    </SdsExplorerModule>
    <div class="library-footer">
      <p v-if="!loading && category !== 'SDS' && !roots.length" class="library-note">No {{ category }} category folder is configured. Showing the master library.</p>
      <details class="library-help"><summary>Library help</summary><p v-if="auth.rawRole === 'admin'">Choose a folder, then Upload document. New folder organizes files; a file's menu lets you upload a new revision. Bulk PDF import is under More.</p><p v-else>Browse and search documents available to your account. An Admin manages uploads.</p></details>
    </div>
  </section>
</template>
<style scoped>
.company-library-widget { container-type: inline-size; display: flex; flex-direction: column; gap: .75rem; width: 100%; height: 100%; min-width: 0; min-height: 0; }
.company-library-widget :deep(.sds-module) { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.company-library-widget :deep(.sds-fieldset) { display: flex; flex: 1; min-height: 0; }
.company-library-widget :deep(.document-explorer) { display: flex; flex-direction: column; width: 100%; min-height: 0; flex: 1; }
.company-library-widget :deep(.document-explorer__body) { flex: 1; min-height: 0; height: auto; }
.company-library-widget :deep(.document-explorer__viewer > .supplied-reference) { overflow: auto; padding: 1rem; }
.company-library-widget :deep(.document-explorer__viewer > button) { flex: none; align-self: start; margin: .5rem; }
.company-library-widget :deep(.sds-editor) { flex: 1; min-height: 0; }
.library-collections { display: grid; gap: .15rem; padding-bottom: .5rem; margin-bottom: .35rem; border-bottom: 1px solid var(--border); }
.library-collections button { display: flex; align-items: center; gap: .5rem; padding: .6rem .4rem; border: 0; border-radius: 4px; background: transparent; color: var(--text); font: inherit; text-align: left; cursor: pointer; min-height: 40px; }
.library-collections button[aria-pressed='true'] { background: var(--field-hover); box-shadow: inset 2px 0 var(--accent); font-weight: 600; }
.library-collections button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.library-collections button:disabled { opacity: .6; cursor: default; }
.library-footer { flex: none; display: flex; flex-wrap: wrap; gap: .5rem 1rem; align-items: start; color: var(--text-muted); font-size: .85rem; }
.library-note { margin: 0; }
.library-help { margin-left: auto; }
.library-help summary { cursor: pointer; }
.library-help p { max-width: 65ch; line-height: 1.5; }
@container (max-width: 600px) {
  .company-library-widget :deep(.document-explorer__header) { flex-wrap: wrap; }
  .company-library-widget :deep(.document-explorer__body) { grid-template-columns: minmax(120px, 38%) minmax(0, 1fr); }
  .company-library-widget :deep(.document-explorer__search) { flex: 1 1 55%; }
  .company-library-widget :deep(.sds-form-grid) { grid-template-columns: 1fr; }
}
</style>
