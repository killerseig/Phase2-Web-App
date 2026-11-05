<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AppLoadingRegion from '@/components/common/AppLoadingRegion.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppButtonLink from '@/components/common/AppButtonLink.vue'
import AppPane from '@/components/common/AppPane.vue'
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppListButton from '@/components/common/AppListButton.vue'
import AppSplitWorkspace from '@/components/common/AppSplitWorkspace.vue'
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
const { content, packages, selectedPackage, loading: referencesLoading, error: referencesError, notice, selectSource, reload } = usePrivateReferences()
const auth = useAuthStore(), templates = ref<ServerFormTemplate[]>([]), loading = ref(true), error = ref(''), search = ref('')
const allowed = computed(() => !!auth.currentUser?.uid && auth.hasWorkspaceAccess && canListCompanyForms(auth.rawRole))
const pageLoading = computed(() => allowed.value && (loading.value || referencesLoading.value))
const availableReports = computed(() => alphabetizeFormChoices(templates.value.filter(item => item.definition && item.latestVersion && !item.archived &&
  canSubmitForm(item.definition.access, { uid: auth.currentUser?.uid || '', role: auth.rawRole, active: auth.hasWorkspaceAccess })).map(item => ({ id: item.id, label: item.definition!.title }))))
const reports = computed(() => availableReports.value.filter(item => item.label.toLowerCase().includes(search.value.trim().toLowerCase())))
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
<template>
  <AppShell class="forms-workspace">
    <AppPageLayout title="Forms" description="Open a form, then enter the requested job and site details." fill>
      <template v-if="auth.rawRole === 'admin'" #actions>
        <AppButtonLink class="forms-manage-button" variant="ghost" to="/admin/forms">
          <i class="pi pi-pencil" aria-hidden="true" /><span>Manage forms</span>
        </AppButtonLink>
      </template>
      <AppSplitWorkspace mode="single">
        <template #primary>
        <AppLoadingRegion class="company-reports__workspace" aria-label="Forms workspace" :loading="pageLoading" label="Loading forms…">
          <AppPane class="company-reports__directory" aria-label="Inspection form directory">
            <AppPaneHeader title="Form directory" title-tag="h2" />
            <div class="company-reports__body">
              <AppSearchInput v-model="search" aria-label="Search forms" placeholder="Search forms" />
              <div v-if="allowed" class="company-reports__summary" aria-live="polite">
                <span>{{ availableReports.length }} published</span><span>{{ reports.length }} visible</span>
              </div>
              <p v-else>Forms are not available for your current role.</p>
              <div class="company-reports__list">
                <AppStatusMessage v-if="error" tone="error">{{ error }} <AppButton @click="load">Retry</AppButton></AppStatusMessage>
                <AppEmptyState v-else-if="allowed && !reports.length" panel message="No published forms match your search and access. Draft forms require administrator review and publication." />
                <ul v-else-if="allowed" class="company-reports__rows" aria-label="Available inspection forms">
                  <li v-for="report in reports" :key="report.id">
                    <AppListButton class="company-reports__row" :to="'/forms/' + encodeURIComponent(report.id)"><strong>{{ report.label }}</strong></AppListButton>
                  </li>
                </ul>
                <PrivateReferenceStatus :show-empty-state="false" :show-loading="false" :loading="referencesLoading" :error="referencesError" :notice="notice" :packages="packages" :selected="selectedPackage" @select="selectSource" @retry="reload" />
                <template v-if="content">
                  <h2>Supplied form references</h2>
                  <p>Reference text from the supplied ZIP. These are not published submission workflows.</p>
                  <p v-if="!references.length">No supplied form references match your search.</p>
                  <details v-for="item in references" :key="item.id">
                    <summary>{{ item.title }} - reference only</summary>
                    <template v-if="auth.rawRole === 'admin'">
                      <p v-if="suppliedStarterDecision(item)">{{ suppliedStarterDecision(item) }}</p>
                      <p v-else><RouterLink to="/admin/forms">Prepare an editable draft in Form Builder</RouterLink>. Saving and publication are separate Admin actions.</p>
                    </template>
                    <SuppliedReferenceReader :title="item.title" :form="item" />
                  </details>
                </template>
              </div>
            </div>
          </AppPane>
        </AppLoadingRegion>
        </template>
      </AppSplitWorkspace>
    </AppPageLayout>
  </AppShell>
</template>
<style scoped>
.company-reports__workspace { height: 100%; min-height: 0; }
.company-reports__body { display: grid; grid-template-rows: auto auto minmax(0, 1fr); gap: var(--space-4); min-width: 0; min-height: 0; }
.company-reports__summary { display: flex; flex-wrap: wrap; gap: var(--space-3); color: var(--text-soft); font-size: var(--font-size-xs); font-variant-numeric: tabular-nums; }
.company-reports__summary span + span { padding-left: var(--space-3); border-left: 1px solid var(--border); }
.company-reports__list { display: grid; grid-auto-rows: max-content; align-content: start; gap: var(--space-1); min-height: 0; overflow: auto; padding-right: .15rem; }
.company-reports__rows { display: grid; grid-auto-rows: max-content; gap: var(--space-1); list-style: none; margin: 0; padding: 0; }
.company-reports__row { --app-list-button-padding: .5rem .65rem; min-height: 3rem; min-width: 0; overflow-wrap: anywhere; }
.company-reports__row strong { font-size: 1.0625rem; letter-spacing: -.015em; }
.company-reports__list details { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: .8rem 1rem; background: var(--surface); }
.company-reports__list summary { cursor: pointer; font-weight: var(--font-weight-heading); }
.forms-manage-button { display: inline-flex; align-items: center; gap: var(--space-2); min-height: var(--control-height-md); padding: 0 var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-sm); background: transparent; color: var(--text-muted); box-shadow: none; font-size: var(--font-size-sm); font-weight: var(--font-weight-heading); }
.forms-manage-button :deep(.pi) { color: var(--accent); font-size: var(--font-size-sm); }
.forms-manage-button:hover { color: var(--text); border-color: var(--text-soft); background: var(--field-hover); }
@media (max-width: 900px) {
  .company-reports__workspace { --loading-region-min-height: min(60dvh, 36rem); height: auto; }
  .company-reports__directory { --app-pane-height: auto; }
  .company-reports__list { max-height: min(60dvh, 34rem); }
}
</style>
