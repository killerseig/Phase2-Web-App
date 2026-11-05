<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { formApi } from '@/services/forms'
import AppShell from '@/layouts/AppShell.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppButtonLink from '@/components/common/AppButtonLink.vue'
import AppCard from '@/components/common/AppCard.vue'
import AppSectionHeader from '@/components/common/AppSectionHeader.vue'
import AppStatusMessage from '@/components/common/AppStatusMessage.vue'
import FormPresentation from '@/components/forms/FormPresentation.vue'
import { canListCompanyForms } from '@/features/forms/availableForms'
import FormSignaturePad from '@/components/forms/FormSignaturePad.vue'
import { completedAnswers } from '@/features/forms/completedAnswers'
import { type FormAnswers, type FormVersion } from '../../functions/src/formModel'
const route = useRoute(),
  auth = useAuthStore(),
  record = ref<{
    id: string
    definition: FormVersion
    answers: FormAnswers
    templateVersion: number
    submittedAt: number
    requireLogin: boolean
  }>(),
  error = ref(''),
  loading = ref(true),
  photo = ref(''),
  photoLabel = ref(''),
  dialog = ref<HTMLDialogElement>(),
  busy = ref(false)
let generation = 0
const activeField = ref(''),
  activeIndex = ref(0)
const rows = computed(() =>
  record.value ? completedAnswers(record.value.definition.fields, record.value.answers) : [],
)
const activePhotos = computed(
  () => rows.value.find((row) => row.key === activeField.value)?.photos || [],
)
const id = computed(() => String(route.params.id || ''))
async function load() {
  const current = ++generation
  record.value = undefined
  photo.value = ''
  dialog.value?.close()
  loading.value = true
  busy.value = false
  error.value = ''
  try {
    await auth.init()
    if (current !== generation) return
    const next = await formApi<typeof record.value>('formSubmissionViewer', {
      action: 'get',
      id: id.value,
    })
    if (current === generation) {
      record.value = next
      await nextTick()
      if (current !== generation) return
      if (route.hash.startsWith('#label-')) {
        try { document.getElementById(decodeURIComponent(route.hash.slice(1)))?.scrollIntoView() } catch { /* malformed links do not affect private entry loading */ }
      }
    }
  } catch (caught) {
    if (current === generation) error.value = (caught as Error).message
  } finally {
    if (current === generation) loading.value = false
  }
}
async function viewPhoto(
  assetId: string,
  label: string,
  fieldId = activeField.value,
  index = activeIndex.value,
) {
  if (busy.value || !record.value) return
  const current = generation
  busy.value = true
  error.value = ''
  try {
    const image = await formApi<{ base64: string; contentType: string }>('formSubmissionViewer', {
      action: 'photo',
      id: id.value,
      assetId,
    })
    if (current !== generation) return
    activeField.value = fieldId
    activeIndex.value = index
    photo.value = 'data:' + image.contentType + ';base64,' + image.base64
    photoLabel.value = label
    dialog.value?.showModal()
  } catch (caught) {
    if (current === generation) error.value = (caught as Error).message
  } finally {
    if (current === generation) busy.value = false
  }
}
async function stepPhoto(delta: number) {
  const index = activeIndex.value + delta,
    id = activePhotos.value[index]
  if (id)
    await viewPhoto(
      id,
      (rows.value.find((row) => row.key === activeField.value)?.label || 'Photo') +
        ' ' +
        (index + 1),
      activeField.value,
      index,
    )
}
async function downloadPdf(language?: 'en') {
  if (busy.value || !record.value) return
  const current = generation
  busy.value = true
  error.value = ''
  try {
    const result = await formApi<{ base64: string; contentType: string; filename: string }>(
      'formSubmissionViewer',
      { action: 'pdf', id: id.value, ...(language ? { language } : {}) },
    )
    if (current !== generation) return
    const url = URL.createObjectURL(
      new Blob([Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0))], {
        type: result.contentType,
      }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = result.filename
    link.click()
    URL.revokeObjectURL(url)
  } catch (caught) {
    if (current === generation) {
      const failure = caught as { code?: string; message?: string }
      error.value =
        ['functions/internal', 'functions/unavailable', 'functions/deadline-exceeded', 'functions/resource-exhausted'].includes(failure?.code || '') ||
        /^internal(?: \[500\])?$/i.test(failure?.message || '')
          ? 'The PDF could not be generated. Your saved report and photos are unchanged. Please try again.'
          : failure?.message || 'The PDF could not be downloaded. Your saved report is unchanged.'
    }
  } finally {
    if (current === generation) busy.value = false
  }
}
watch([
  id,
  () => auth.currentUser?.uid,
  () => auth.rawRole,
  () => auth.hasWorkspaceAccess,
  () => (auth.profile?.assignedJobIds || []).join('|'),
], load, { immediate: true, flush: 'sync' })
onBeforeUnmount(() => {
  generation++
  dialog.value?.close()
  photo.value = ''
})
</script>
<template>
  <AppShell><main class="submission-view">
    <FormPresentation :title="record?.definition.title || 'Completed form'" main-label="Completed answers">
      <template #header-actions><AppButtonLink v-if="auth.hasWorkspaceAccess && canListCompanyForms(auth.rawRole)" to="/reports">Back to forms</AppButtonLink></template>
      <template #messages>
        <AppStatusMessage v-if="loading" message="Loading completed form." />
        <AppStatusMessage v-if="error" tone="error" :message="error" />
        <AppButtonLink v-if="error && !auth.hasWorkspaceAccess" :to="{ name: 'login', query: { redirect: route.fullPath } }">Sign in to view this entry</AppButtonLink>
      </template>
      <article v-if="record" aria-label="Submitted answers">
        <p v-if="record.definition.description" class="submission-view__description">{{ record.definition.description }}</p>
        <section v-for="(row, index) in rows" :id="'label-' + row.key" :key="row.key" class="submission-view__answer">
          <h2 v-if="row.group && rows[index - 1]?.group !== row.group">{{ row.group }}</h2>
          <h3>{{ row.label }}</h3>
          <FormSignaturePad v-if="row.signature" :model-value="row.signature" :label="row.label" readonly />
          <p v-else class="answer">{{ row.value }}</p>
          <div v-if="row.photos.length" class="submission-view__actions"><AppButton v-for="(assetId, photoIndex) in row.photos" :key="assetId" :disabled="busy" @click="viewPhoto(assetId, row.label + ' ' + (photoIndex + 1), row.key, photoIndex)">View {{ row.label }} {{ photoIndex + 1 }}</AppButton></div>
        </section>
      </article>
      <template #sidebar>
        <AppCard v-if="record" as="section" class="submission-view__information" aria-label="Completed record information">
          <AppSectionHeader title="Completed record" title-tag="h2" />
          <dl><dt>Submitted</dt><dd>{{ new Date(record.submittedAt).toLocaleString() }}</dd><dt>Issued version</dt><dd>{{ record.templateVersion }}</dd></dl>
          <AppButton data-testid="entry-pdf-download" variant="primary" :disabled="busy" @click="downloadPdf()">Download original PDF with photos</AppButton>
          <p class="submission-view__privacy">Entry and photo access is checked for every private view and download.</p>
        </AppCard>
      </template>
    </FormPresentation>
    <dialog ref="dialog" class="submission-view__photo-dialog" aria-label="Submission photo" @keydown.left.prevent="stepPhoto(-1)" @keydown.right.prevent="stepPhoto(1)">
      <AppCard as="div" class="submission-view__photo-panel">
        <AppSectionHeader title="Inspection photo" title-tag="h2"><template #actions><AppButton @click="dialog?.close()">Close photo</AppButton></template></AppSectionHeader>
        <img v-if="photo" :src="photo" :alt="photoLabel" />
        <div class="submission-view__actions"><AppButton :disabled="busy || activeIndex <= 0" @click="stepPhoto(-1)">Previous photo</AppButton><AppButton :disabled="busy || activeIndex >= activePhotos.length - 1" @click="stepPhoto(1)">Next photo</AppButton></div>
      </AppCard>
    </dialog>
  </main></AppShell>
</template>
<style scoped>
.submission-view { width: 100%; min-width: 0; overflow-wrap: anywhere; }
.submission-view__answer { display: grid; gap: .5rem; padding: 1rem 0; border-bottom: 1px solid var(--border-soft); scroll-margin-top: 1rem; }
.submission-view__answer:last-child { border-bottom: 0; padding-bottom: 0; }
.submission-view__answer h2, .submission-view__answer h3 { margin: 0; }
.submission-view__answer h3 { font-size: 1rem; font-weight: 600; color: var(--text-muted); }
.answer, .submission-view__description { white-space: pre-wrap; }
.submission-view__description, .submission-view__privacy { color: var(--text-muted); }
.submission-view__actions { display: flex; flex-wrap: wrap; gap: .5rem; }
.submission-view__information dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: .5rem 1rem; margin: 0; }
.submission-view__information dt { color: var(--text-muted); }
.submission-view__information dd { margin: 0; }
.submission-view__privacy { font-size: .875rem; }
.submission-view__photo-dialog { padding: 0; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface); color: var(--text); max-width: min(70rem, calc(100vw - 2rem)); max-height: calc(100dvh - 2rem); }
.submission-view__photo-dialog::backdrop { background: rgb(0 0 0 / .72); }
.submission-view__photo-panel img { display: block; width: 100%; min-width: 0; max-height: 68dvh; object-fit: contain; }
.submission-view__photo-panel .submission-view__actions { justify-content: flex-end; }
</style>
