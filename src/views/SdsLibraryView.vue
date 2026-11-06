<script setup lang="ts">
import { ref } from 'vue'
import AppShell from '@/layouts/AppShell.vue'
import SdsExplorerModule from '@/components/dashboard/SdsExplorerModule.vue'
const library = ref<InstanceType<typeof SdsExplorerModule>>()
const prepareSignOut = () => library.value?.prepareNavigation() ?? true
</script>
<template>
  <AppShell :before-sign-out="prepareSignOut">
    <SdsExplorerModule ref="library" expanded />
  </AppShell>
</template>
