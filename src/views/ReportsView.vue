<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AppButton from '@/components/common/AppButton.vue'
import AppButtonLink from '@/components/common/AppButtonLink.vue'
import AppPane from '@/components/common/AppPane.vue'
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppField from '@/components/common/AppField.vue'
import AppLinkCard from '@/components/common/AppLinkCard.vue'
import AppPageLayout from '@/components/common/AppPageLayout.vue'
import AppSearchInput from '@/components/common/AppSearchInput.vue'
import AppStatusMessage from '@/components/common/AppStatusMessage.vue'
import AppShell from '@/layouts/AppShell.vue'
import { useAuthStore } from '@/stores/auth'
import { formApi, type ServerFormTemplate } from '@/services/forms'
import { canSubmitForm } from '../../functions/src/formAccess'
import PrivateReferenceStatus from '@/components/intranet/PrivateReferenceStatus.vue'
import SuppliedReferenceReader from '@/components/intranet/SuppliedReferenceReader.vue'
import { usePrivateReferences } from '@/features/intranet/usePrivateReferences'
import { suppliedStarterDecision } from '@/features/forms/suppliedStarters'
import { canListCompanyForms } from '@/features/forms/availableForms'
import { alphabetizeFormChoices } from '@/features/forms/selectorOrder'
const { content, packages, selectedPackage, loading: referencesLoading, error: referencesError, notice, selectSource, reload, cancel } = usePrivateReferences()
const auth = useAuthStore(), templates = ref<ServerFormTemplate[]>([]), loading = ref(true), error = ref(''), search = ref('')
const allowed = computed(() => !!auth.currentUser?.uid && auth.hasWorkspaceAccess && canListCompanyForms(auth.rawRole))
const reports = computed(() => alphabetizeFormChoices(templates.value.filter(item => item.definition && item.latestVersion && !item.archived &&
  canSubmitForm(item.definition.access, { uid: auth.currentUser?.uid || '', role: auth.rawRole, active: auth.hasWorkspaceAccess }) &&
  item.definition.title.toLowerCase().includes(search.value.trim().toLowerCase())).map(item => ({ id: item.id, label: item.definition!.title }))))
const references = computed(() => content.value?.forms.filter(item => item.title.toLowerCase().includes(search.value.trim().toLowerCase())) ?? [])
async function load() {
  const current = ++generation
  loading.value = false; error.value = ''; templates.value = []
  if (!allowed.value) return
  loading.value = true
  try {
    const result = await formApi<{ templates: ServerFormTemplate[] }>('formTemplates', { action: 'list' })
    if (current === generation) templates.value = result.templates
  }
  catch (caught) { if (current === generation) error.value = (caught as Error).message }
  finally { if (current === generation) loading.value = false }
}
let generation = 0
watch([() => auth.currentUser?.uid, () => auth.rawRole, () => auth.hasWorkspaceAccess], () => { void load() }, { immediate: true })
onBeforeUnmount(() => { generation++ })
</script>
<template><AppShell><main class="company-reports">
  <AppPageLayout title="Site Inspection Forms" description="Open a published form without selecting a job. Enter the job and site details requested on the form."><template #actions><AppButtonLink v-if="auth.rawRole === 'admin'" to="/admin/forms">Manage forms in Form Builder</AppButtonLink></template><AppPane class="company-reports__directory" aria-label="Inspection form directory"><AppPaneHeader title="Form directory" title-tag="h2" /><div class="company-reports__body">
  <AppField label="Search reports"><AppSearchInput v-model="search" aria-label="Search reports" placeholder="Find an inspection form" /></AppField>
  <p v-if="!allowed">Forms are not available for your current role.</p>
  <AppStatusMessage v-else-if="loading" message="Loading reports." />
  <AppStatusMessage v-else-if="error" tone="error">{{ error }} <AppButton @click="load">Retry</AppButton></AppStatusMessage>
  <AppEmptyState v-else-if="!reports.length" panel message="No published reports match your search and access. Draft forms require administrator review and publication." />
  <ul v-else class="company-reports__list" aria-label="Available inspection forms"><li v-for="report in reports" :key="report.id"><AppLinkCard :to="'/forms/' + encodeURIComponent(report.id)"><strong>{{ report.label }}</strong></AppLinkCard></li></ul></div></AppPane>
  <PrivateReferenceStatus :show-empty-state="false" :loading="referencesLoading" :error="referencesError" :notice="notice" :packages="packages" :selected="selectedPackage" @select="selectSource" @retry="reload" @cancel="cancel" />
  <template v-if="content"><h2>Supplied form references</h2><p>Reference text from the supplied ZIP. These are not published submission workflows.</p>
    <p v-if="!references.length">No supplied form references match your search.</p>
    <details v-for="item in references" :key="item.id"><summary>{{ item.title }} - reference only</summary>
      <template v-if="auth.rawRole === 'admin'"><p v-if="suppliedStarterDecision(item)">{{ suppliedStarterDecision(item) }}</p><p v-else><RouterLink to="/admin/forms">Prepare an editable draft in Form Builder</RouterLink>. Saving and publication are separate Admin actions.</p></template>
      <SuppliedReferenceReader :title="item.title" :form="item" />
    </details>
  </template>
</AppPageLayout></main></AppShell></template>
<style scoped>
.company-reports { min-width: 0; }
.company-reports__directory { --app-pane-height: auto; }
.company-reports__body { display: grid; gap: 1rem; min-width: 0; min-height: 0; }
.company-reports__list { display: grid; grid-auto-rows: max-content; gap: .15rem; max-height: 26rem; overflow: auto; list-style: none; margin: 0; padding: .2rem; }
.company-reports__list :deep(.app-link-card) { --app-link-card-padding: .65rem; --app-link-card-gap: .2rem; --app-link-card-shadow: none; --app-link-card-radius: var(--radius-sm); --app-link-card-border: 1px solid transparent; --app-link-card-background: transparent; --app-link-card-hover-border-color: var(--border); border-bottom-color: var(--border-soft); min-height: 3.5rem; align-content: center; }
.company-reports details { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: .8rem 1rem; background: var(--surface); }
.company-reports summary { cursor: pointer; font-weight: 600; }
</style>
