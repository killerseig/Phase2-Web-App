<script setup lang="ts">
import { useRoute } from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'
import FormResponseWorkspace from '@/components/forms/FormResponseWorkspace.vue'
const route = useRoute()
</script>
<template>
  <AppShell
    ><FormResponseWorkspace
      :key="route.fullPath"
      :template-id="String(route.params.templateId || '')"
  /></AppShell>
</template>
