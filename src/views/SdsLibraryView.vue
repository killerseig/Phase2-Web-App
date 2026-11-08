<script setup lang="ts">
import { ref } from 'vue'
import AppShell from '@/layouts/AppShell.vue'
import SdsExplorerModule from '@/components/dashboard/SdsExplorerModule.vue'
const library = ref<InstanceType<typeof SdsExplorerModule>>()
const prepareSignOut = () => library.value?.prepareNavigation() ?? true
</script>
<template>
  <AppShell contained :before-sign-out="prepareSignOut">
    <SdsExplorerModule ref="library" class="sds-library" expanded sidebar-tools />
  </AppShell>
</template>
<style scoped>
.sds-library { display: flex; flex-direction: column; width: 100%; min-width: 0; min-height: 0; }
.sds-library :deep(.sds-fieldset) { display: flex; flex: 1; min-height: 0; }
.sds-library :deep(.document-explorer) { width: 100%; display: flex; flex-direction: column; flex: 1; min-height: 0; }
.sds-library :deep(.document-explorer__body) { flex: 1; min-height: 0; height: auto; }
.sds-library :deep(.sds-editor) { flex: 1; min-height: 0; }
</style>
