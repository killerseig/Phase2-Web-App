<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppPane from '@/components/common/AppPane.vue'
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
import AppListButton from '@/components/common/AppListButton.vue'
import { useAuthStore } from '@/stores/auth'
import { formApi, type ServerFormTemplate } from '@/services/forms'
import { canSubmitForm } from '../../../functions/src/formAccess'
import { alphabetizeFormChoices } from '@/features/forms/selectorOrder'
const props = defineProps<{ jobId: string }>()
const auth = useAuthStore(), router = useRouter()
const templates = ref<ServerFormTemplate[]>([]), loading = ref(false), error = ref('')
const allowed = computed(() => !!auth.currentUser?.uid && auth.hasWorkspaceAccess && ['admin', 'project-manager', 'foreman', 'shop-foreman'].includes(auth.rawRole))
const forms = computed(() => alphabetizeFormChoices(templates.value.filter(item => item.definition && item.latestVersion && !item.archived &&
  canSubmitForm(item.definition.access, { uid: auth.currentUser?.uid || '', role: auth.rawRole, active: auth.hasWorkspaceAccess }))
  .map(item => ({ id: item.id, label: item.definition!.title }))))
let generation = 0
async function load() {
  const active = ++generation
  templates.value = []; error.value = ''; loading.value = false
  if (!allowed.value || !props.jobId) return
  loading.value = true
  try {
    const result = await formApi<{ templates: ServerFormTemplate[] }>('formTemplates', { action: 'list' })
    if (active === generation) templates.value = result.templates
  } catch (caught) { if (active === generation) error.value = (caught as Error).message }
  finally { if (active === generation) loading.value = false }
}
function open(id: string) {
  if (allowed.value && forms.value.some(form => form.id === id)) void router.push({ path: '/forms/' + encodeURIComponent(id), query: { dashboardJob: props.jobId } })
}
watch([() => auth.currentUser?.uid, () => auth.rawRole, () => auth.hasWorkspaceAccess, () => props.jobId], () => { void load() }, { immediate: true })
onBeforeUnmount(() => { generation++ })
</script>
<template>
  <AppPane class="job-forms" data-testid="job-forms-list">
    <AppPaneHeader title="Forms" title-tag="h2" />
    <p v-if="!allowed">Forms are not available for your current role.</p>
    <p v-else-if="loading" role="status">Loading available forms.</p>
    <p v-else-if="error" role="alert">{{ error }} <button type="button" @click="load">Retry forms</button></p>
    <p v-else-if="!forms.length">No published forms are available to your account.</p>
    <ul v-else class="job-forms__list" aria-label="Available forms">
      <li v-for="form in forms" :key="form.id"><AppListButton class="job-forms__row" :aria-label="form.label" @click="open(form.id)"><i class="pi pi-file" aria-hidden="true" /><strong>{{ form.label }}</strong><i class="pi pi-angle-right" aria-hidden="true" /></AppListButton></li>
    </ul>
  </AppPane>
</template>
<style scoped>
.job-forms { min-width: 0; --app-pane-height: auto; --app-pane-padding: 1rem; --app-pane-radius: var(--radius); --app-pane-border: 1px solid var(--border); --app-pane-background: var(--panel-background); --app-pane-shadow: none; --app-pane-gap: .75rem; --app-pane-header-title-font-size: 1.15rem; --app-pane-header-title-margin: 0; }
.job-forms.app-pane { border-radius: var(--radius); }
.job-forms :deep(.app-pane-header) { padding-bottom: .75rem; }
.job-forms__list { display: grid; align-content: start; gap: .35rem; height: 16rem; max-height: 45vh; min-height: 8rem; overflow: auto; overscroll-behavior: contain; list-style: none; margin: 0; padding: 0 .2rem .2rem 0; }
.job-forms__list li { min-width: 0; overflow-wrap: anywhere; }
.job-forms__row { display: flex; align-items: center; gap: .75rem; min-height: 2.75rem; line-height: 1.35; --app-list-button-padding: .75rem .85rem; --app-list-button-border: var(--border-soft); --app-list-button-radius: var(--radius-sm); }
.job-forms__row strong { flex: 1; min-width: 0; font-size: .95rem; font-weight: var(--font-weight-heading); }
.job-forms__row .pi { flex: none; font-size: .9rem; color: var(--text-muted); }
.job-forms__row:hover { border-color: var(--border-strong); background: var(--field-hover); }
.job-forms__row:active { border-color: var(--border-strong); background: var(--bg-accent); }
.job-forms__row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
@media (max-width: 560px) { .job-forms { --app-pane-padding: .85rem; } .job-forms__row { --app-list-button-padding: .7rem; } }
</style>
