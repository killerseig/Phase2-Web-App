<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { formApi } from '@/services/forms'
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
  error.value = ''
  try {
    await auth.init()
    const next = await formApi<typeof record.value>('formSubmissionViewer', {
      action: 'get',
      id: id.value,
    })
    if (current === generation) {
      record.value = next
      await nextTick()
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
    error.value = (caught as Error).message
  } finally {
    busy.value = false
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
  busy.value = true
  error.value = ''
  try {
    const result = await formApi<{ base64: string; contentType: string; filename: string }>(
      'formSubmissionViewer',
      { action: 'pdf', id: id.value, ...(language ? { language } : {}) },
    )
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
    error.value = (caught as Error).message
  } finally {
    busy.value = false
  }
}
watch(id, load, { immediate: true })
</script>
<template>
  <main class="submission-view">
    <p v-if="loading" role="status">Loading completed form…</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <RouterLink
      v-if="error && !auth.hasWorkspaceAccess"
      :to="{ name: 'login', query: { redirect: route.fullPath } }"
      >Sign in to view this entry</RouterLink
    >
    <article v-if="record">
      <h1>{{ record.definition.title }}</h1>
      <p>{{ record.definition.description }}</p>
      <p>
        Submitted version {{ record.templateVersion }} ·
        {{ new Date(record.submittedAt).toLocaleString() }}
      </p>
      <button :disabled="busy" @click="downloadPdf()">Download original PDF with photos</button>
      <section v-for="(row, index) in rows" :id="'label-' + row.key" :key="row.key">
        <h2 v-if="row.group && rows[index - 1]?.group !== row.group">{{ row.group }}</h2>
        <h3>{{ row.label }}</h3>
        <p class="answer">{{ row.value }}</p>
        <button
          v-for="(assetId, photoIndex) in row.photos"
          :key="assetId"
          :disabled="busy"
          @click="viewPhoto(assetId, row.label + ' ' + (photoIndex + 1), row.key, photoIndex)"
        >
          View {{ row.label }} {{ photoIndex + 1 }}
        </button>
      </section>
      <p>Entry and photo access is checked for every private view and download.</p>
    </article>
    <dialog
      ref="dialog"
      aria-label="Submission photo"
      @keydown.left.prevent="stepPhoto(-1)"
      @keydown.right.prevent="stepPhoto(1)"
    >
      <button @click="dialog?.close()">Close photo</button
      ><button :disabled="busy || activeIndex <= 0" @click="stepPhoto(-1)">Previous photo</button
      ><button :disabled="busy || activeIndex >= activePhotos.length - 1" @click="stepPhoto(1)">
        Next photo</button
      ><img v-if="photo" :src="photo" :alt="photoLabel" />
    </dialog>
  </main>
</template>
<style scoped>
.submission-view {
  max-width: 60rem;
  margin: 0 auto;
  padding: clamp(1rem, 4vw, 3rem);
  color: var(--text);
  overflow-wrap: anywhere;
}
.submission-view section {
  margin: 1rem 0;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.4rem;
}
.answer,
.submission-view p {
  white-space: pre-wrap;
}
.submission-view button {
  margin: 0.3rem;
  padding: 0.5rem 0.8rem;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 0.3rem;
}
.submission-view input {
  width: 100%;
  padding: 0.5rem;
  box-sizing: border-box;
}
.submission-view dialog {
  max-width: 90vw;
  max-height: 90dvh;
}
.submission-view dialog img {
  display: block;
  max-width: 80vw;
  max-height: 75dvh;
  object-fit: contain;
}
</style>
