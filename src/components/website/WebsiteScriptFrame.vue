<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { websiteCommand, submitWebsiteForm } from '@/services/website'
import { customDefinition } from '../../../functions/src/websiteCustom'
import type { WebsiteSite } from '@/features/website/types'
const props = defineProps<{ site: WebsiteSite; pageId: string; preview?: boolean }>()
const frame = ref<HTMLIFrameElement>()
const height = ref(640)
const error = ref('')
const revision = ref(0)
const token = ref(crypto.randomUUID())
const ready = ref(false)
const page = computed(() => props.site.pages.find((page) => page.id === props.pageId))
const allowedForms = computed(
  () =>
    new Set(
      [
        ...(page.value?.sections || []),
        ...(page.value?.useSiteLayout ? props.site.sharedLayout?.sections || [] : []),
      ]
        .map((section) => section.formId)
        .filter(Boolean),
    ),
)
const pending = new Set<string>()
function publicDraft() {
  const site = JSON.parse(JSON.stringify(props.site)) as WebsiteSite
  delete site.savedSections
  site.pages = site.pages.map((page) =>
    page.id === props.pageId ? page : { ...page, sections: [], html: undefined, js: undefined },
  )
  if (!page.value?.useSiteLayout) delete site.sharedLayout
  const sections = [
    ...(site.pages.find((page) => page.id === props.pageId)?.sections || []),
    ...(site.sharedLayout?.sections || []),
  ]
  const customIds = new Set(sections.map((section) => section.custom?.definitionId))
  site.customWidgets = site.customWidgets?.filter((definition) => customIds.has(definition.id))
  site.forms = site.forms
    ?.filter((form) => allowedForms.value.has(form.id))
    .map((form) => {
      const publicForm = { ...form }
      delete publicForm.delivery
      return publicForm
    })
  return site
}
async function initialize() {
  if (!ready.value || !frame.value?.contentWindow) return
  const current = token.value
  error.value = ''
  const site = publicDraft()
  const sections = [
    ...site.pages.flatMap((page) => page.sections),
    ...(site.sharedLayout?.sections || []),
    ...(site.customWidgets || []).flatMap((definition) => definition.sections),
  ]
  const ids = new Set(
    [
      site.branding?.logoId,
      ...sections.flatMap((section) => [
        section.imageId,
        ...section.items.map((item) => item.imageId),
        ...(section.custom?.inline?.sections || []).flatMap((child) => [
          child.imageId,
          ...child.items.map((item) => item.imageId),
        ]),
      ]),
      ...(site.customWidgets || []).flatMap((definition) =>
        definition.fields
          .filter((field) => field.type === 'image')
          .map((field) => field.defaultValue),
      ),
      ...sections.flatMap((section) => {
        const definition = customDefinition(section.custom, site.customWidgets)
        return (definition?.fields || [])
          .filter((field) => field.type === 'image')
          .map((field) => section.custom?.values[field.key] ?? field.defaultValue)
      }),
    ].filter((id): id is string => !!id && /^[a-zA-Z0-9_-]+$/.test(id)),
  )
  const images: Record<string, string> = {}
  await Promise.all(
    [...ids].map(async (id) => {
      try {
        if (props.preview) {
          const result = await websiteCommand<{ base64: string }>('getImage', { id })
          images[id] = 'data:image/webp;base64,' + result.base64
        } else {
          const response = await fetch('/website-image?id=' + encodeURIComponent(id), {
            credentials: 'omit',
          })
          if (!response.ok) return
          const blob = await response.blob()
          images[id] = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result))
            reader.readAsDataURL(blob)
          })
        }
      } catch {
        /* The renderer displays an unavailable image. */
      }
    }),
  )
  if (current !== token.value) return
  frame.value?.contentWindow?.postMessage(
    {
      type: 'website-init',
      token: current,
      site,
      pageId: props.pageId,
      images,
      preview: !!props.preview,
    },
    '*',
  )
}
async function receive(event: MessageEvent) {
  if (event.source !== frame.value?.contentWindow || !event.data || typeof event.data !== 'object')
    return
  const data = event.data
  if (data.type === 'website-ready') {
    if (ready.value) return
    ready.value = true
    await initialize()
    return
  }
  if (data.token !== token.value) return
  if (data.type === 'website-height' && Number.isFinite(data.height))
    height.value = Math.max(200, Math.min(50000, data.height))
  if (data.type === 'website-error') error.value = String(data.message).slice(0, 500)
  if (
    data.type !== 'website-form' ||
    props.preview ||
    !allowedForms.value.has(data.formId) ||
    typeof data.requestId !== 'string' ||
    data.requestId.length > 80 ||
    pending.has(data.requestId) ||
    pending.size >= 3
  )
    return
  const requestToken = token.value
  pending.add(data.requestId)
  let message = ''
  try {
    await submitWebsiteForm({
      formId: data.formId,
      submissionId: data.submissionId,
      values: data.values,
      website: data.website,
    })
  } catch {
    message = 'Your message could not be sent. Please try again.'
  } finally {
    pending.delete(data.requestId)
  }
  if (requestToken === token.value)
    frame.value?.contentWindow?.postMessage(
      {
        type: 'website-form-result',
        token: requestToken,
        requestId: data.requestId,
        error: message,
      },
      '*',
    )
}
// Replacing the entire frame stops old listeners, timers and scripts on page/draft changes.
watch(
  () => [props.site, props.pageId],
  () => {
    ready.value = false
    token.value = crypto.randomUUID()
    revision.value++
    error.value = ''
    pending.clear()
  },
  { deep: true },
)
onMounted(() => window.addEventListener('message', receive))
onBeforeUnmount(() => window.removeEventListener('message', receive))
</script>
<template>
  <div class="script-preview">
    <p v-if="error" role="alert">
      {{ preview ? 'Code preview: ' : 'Website interaction: ' }}{{ error }}
    </p>
    <iframe
      :key="revision"
      ref="frame"
      src="/website-runtime.html"
      title="Website code preview"
      sandbox="allow-scripts allow-forms allow-top-navigation-by-user-activation"
      referrerpolicy="no-referrer"
      :style="{ height: height + 'px' }"
    />
  </div>
</template>
<style scoped>
iframe {
  display: block;
  width: 100%;
  border: 0;
  background: white;
}
[role='alert'] {
  padding: 0.6rem;
}
</style>
