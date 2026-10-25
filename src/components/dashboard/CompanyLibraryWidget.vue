<script setup lang="ts">
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
import SdsExplorerModule from './SdsExplorerModule.vue'
import PrivateReferenceStatus from '@/components/intranet/PrivateReferenceStatus.vue'
import { usePrivateReferences } from '@/features/intranet/usePrivateReferences'
import { useAuthStore } from '@/stores/auth'
withDefaults(defineProps<{ showHeading?: boolean }>(), { showHeading: true })
const auth = useAuthStore()
const { content, packages, selectedPackage, loading: referencesLoading, error: referencesError, notice, selectSource, reload, cancel } = usePrivateReferences()
</script>
<template>
  <section class="company-library-widget" aria-label="Company Library widget">
    <AppPaneHeader v-if="showHeading" title="Company Library" title-tag="h1" />
    <PrivateReferenceStatus :loading="referencesLoading" :error="referencesError" :notice="notice" :packages="packages" :selected="selectedPackage" :show-empty-state="false" @select="selectSource" @retry="reload" @cancel="cancel" />
    <SdsExplorerModule expanded title="Documents" :references="content" />
    <div class="library-footer">
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
.library-footer { flex: none; display: flex; flex-wrap: wrap; gap: .5rem 1rem; align-items: start; color: var(--text-muted); font-size: .85rem; }
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
