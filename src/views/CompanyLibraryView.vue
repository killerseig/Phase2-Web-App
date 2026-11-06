<script setup lang="ts">
import { ref } from 'vue'
import AppShell from '@/layouts/AppShell.vue'
import CompanyLibraryWidget from '@/components/dashboard/CompanyLibraryWidget.vue'
const library = ref<InstanceType<typeof CompanyLibraryWidget>>()
const prepareSignOut = () => library.value?.prepareNavigation() ?? true
</script>
<template><AppShell contained :before-sign-out="prepareSignOut"><CompanyLibraryWidget ref="library" :show-heading="false" /></AppShell></template>
