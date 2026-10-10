<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'
import { useAuthStore } from '@/stores/auth'
import { formApi, type ServerFormTemplate } from '@/services/forms'
import { canSubmitForm } from '../../functions/src/formAccess'
const auth = useAuthStore(), templates = ref<ServerFormTemplate[]>([]), loading = ref(true), error = ref(''), search = ref('')
const reports = computed(() => templates.value.filter(item => item.definition && item.latestVersion && !item.archived &&
  canSubmitForm(item.definition.access, { uid: auth.currentUser?.uid || '', role: auth.rawRole, active: auth.hasWorkspaceAccess }) &&
  item.definition.title.toLowerCase().includes(search.value.trim().toLowerCase())))
async function load() {
  loading.value = true; error.value = ''; templates.value = []
  try { templates.value = (await formApi<{ templates: ServerFormTemplate[] }>('formTemplates', { action: 'list' })).templates }
  catch (caught) { error.value = (caught as Error).message }
  finally { loading.value = false }
}
onMounted(() => { void load() })
</script>
<template><AppShell><main class="company-reports">
  <h1>Reports</h1><p>Published company forms available to your account. Entry and editing permissions are checked separately.</p>
  <RouterLink v-if="auth.rawRole === 'admin'" to="/admin/forms">Manage forms in Form Builder</RouterLink>
  <label>Search reports <input v-model="search" type="search" /></label>
  <p v-if="loading" role="status">Loading reports.</p>
  <p v-else-if="error" role="alert">{{ error }} <button @click="load">Retry</button></p>
  <p v-else-if="!reports.length">No published reports match your search and access. Draft forms require administrator review and publication.</p>
  <ul v-else><li v-for="report in reports" :key="report.id"><RouterLink :to="'/forms/' + encodeURIComponent(report.id)">{{ report.definition!.title }}</RouterLink></li></ul>
</main></AppShell></template>
<style scoped>.company-reports { padding: 1rem; } label { display: block; margin: 1rem 0; } li { padding: .4rem 0; }</style>
