<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'
import FormResponseWorkspace from '@/components/forms/FormResponseWorkspace.vue'
const route = useRoute()
const workspace = ref<InstanceType<typeof FormResponseWorkspace>>()
const prepareSignOut = () => workspace.value?.prepareNavigation() ?? true
</script>
<template>
  <AppShell :before-sign-out="prepareSignOut"
    ><FormResponseWorkspace
      ref="workspace"
      :key="route.fullPath"
      :template-id="String(route.params.templateId || '')"
      :open-for-job="typeof route.query.dashboardJob === 'string' && !!route.query.dashboardJob"
  /></AppShell>
</template>
