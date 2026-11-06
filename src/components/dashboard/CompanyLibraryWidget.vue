<script setup lang="ts">
import { computed, ref } from 'vue'
import AppLoadingRegion from '@/components/common/AppLoadingRegion.vue'
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
import SdsExplorerModule from './SdsExplorerModule.vue'
import PrivateReferenceStatus from '@/components/intranet/PrivateReferenceStatus.vue'
import { usePrivateReferences } from '@/features/intranet/usePrivateReferences'
withDefaults(defineProps<{ showHeading?: boolean }>(), { showHeading: true })
const { content, packages, selectedPackage, loading: referencesLoading, error: referencesError, notice, selectSource, reload } = usePrivateReferences()
const explorer = ref<InstanceType<typeof SdsExplorerModule>>()
defineExpose({ prepareNavigation: () => explorer.value?.prepareNavigation() ?? true })
const documentsReady = ref(false)
const loading = computed(() => referencesLoading.value || !documentsReady.value)
function documentLoadingChanged(value: boolean) { if (!value) documentsReady.value = true }
</script>
<template>
  <AppLoadingRegion class="company-library-widget" aria-label="Company Library widget" :loading="loading" label="Loading Company Library…">
    <AppPaneHeader v-if="showHeading" title="Company Library" title-tag="h1" />
    <PrivateReferenceStatus :loading="referencesLoading" :error="referencesError" :notice="notice" :packages="packages" :selected="selectedPackage" :show-empty-state="false" :show-loading="false" @select="selectSource" @retry="reload" />
    <SdsExplorerModule ref="explorer" expanded sidebar-tools title="Documents" :references="content" @loading-change="documentLoadingChanged" />
  </AppLoadingRegion>
</template>
<style scoped>
.company-library-widget { position: relative; container-type: inline-size; display: flex; flex-direction: column; gap: .75rem; width: 100%; height: 100%; min-width: 0; min-height: 0; }
.company-library-widget :deep(.sds-module) { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.company-library-widget :deep(.sds-fieldset) { display: flex; flex: 1; min-height: 0; }
.company-library-widget :deep(.document-explorer) { display: flex; flex-direction: column; width: 100%; min-height: 0; flex: 1; }
.company-library-widget :deep(.document-explorer__body) { flex: 1; min-height: 0; height: auto; }
.company-library-widget :deep(.document-explorer__viewer > .supplied-reference) { overflow: auto; padding: 1rem; }
.company-library-widget :deep(.document-explorer__viewer > button) { flex: none; align-self: start; margin: .5rem; }
.company-library-widget :deep(.sds-editor) { flex: 1; min-height: 0; }
@container (max-width: 600px) {
  .company-library-widget :deep(.document-explorer__header) { flex-wrap: wrap; }
  .company-library-widget :deep(.document-explorer__body) { grid-template-columns: minmax(120px, 38%) minmax(0, 1fr); }
  .company-library-widget :deep(.document-explorer__search) { flex: 1 1 55%; }
  .company-library-widget :deep(.sds-form-grid) { grid-template-columns: 1fr; }
}
</style>
