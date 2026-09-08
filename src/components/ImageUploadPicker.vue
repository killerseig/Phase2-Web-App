<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import FileUpload, { type FileUploadUploaderEvent } from 'primevue/fileupload'
import AppButton from '@/components/common/AppButton.vue'
import AppCard from '@/components/common/AppCard.vue'
import AppTextarea from '@/components/common/AppTextarea.vue'
import type { DailyLogAttachmentRecord } from '@/types/domain'

export interface ImageUploadEntry {
  file: File
  description: string
}

const props = withDefaults(
  defineProps<{
    attachments: DailyLogAttachmentRecord[]
    chooseLabel?: string
    descriptionLabel?: string
    emptyLabel?: string
    helperText?: string
    disabled?: boolean
    busy?: boolean
    maxFileSize?: number
    uploadHandler: (entries: ImageUploadEntry[]) => Promise<void>
  }>(),
  {
    chooseLabel: 'Choose Images',
    descriptionLabel: 'Description',
    emptyLabel: 'Drag and drop files here to upload.',
    helperText: 'Choose one or more images. Use the image button again to add more.',
    disabled: false,
    busy: false,
  },
)

const emit = defineEmits<{
  updateDescription: [payload: { path: string; description: string }]
  commitDescription: []
  remove: [path: string]
}>()

const uploader = ref<{ clear: () => void } | null>(null)
const lightbox = ref<HTMLElement | null>(null)
const localMessages = ref<string[]>([])
const previewIndex = ref<number | null>(null)
const previewTrigger = ref<HTMLElement | null>(null)
const previewAttachments = computed(() => props.attachments.filter((attachment) => attachment.url))
const previewImage = computed(() => {
  if (previewIndex.value === null) return null
  return previewAttachments.value[previewIndex.value] ?? null
})
const previewPosition = computed(() => (previewIndex.value ?? 0) + 1)

function toFiles(files: unknown) {
  if (Array.isArray(files)) return files as File[]
  return files instanceof File ? [files] : []
}

function handleSelect() {
  localMessages.value = []
}

function normalizeMessages(messages: unknown) {
  const builtInMessages = Array.isArray(messages)
    ? messages.filter((entry): entry is string => typeof entry === 'string')
    : []

  return [...new Set([...builtInMessages, ...localMessages.value])]
}

async function handleUploader(event: FileUploadUploaderEvent) {
  const files = toFiles(event.files)
  if (!files.length || props.disabled || props.busy) return

  localMessages.value = []

  try {
    await props.uploadHandler(
      files.map((file) => ({
        file,
        description: '',
      })),
    )
  } catch (error) {
    localMessages.value = [error instanceof Error ? error.message : 'Failed to upload files.']
  } finally {
    uploader.value?.clear()
  }
}

function openPreview(path: string) {
  const index = previewAttachments.value.findIndex((attachment) => attachment.path === path)
  if (index < 0) return

  previewTrigger.value =
    document.activeElement instanceof HTMLElement ? document.activeElement : null
  previewIndex.value = index
}

async function closePreview() {
  previewIndex.value = null
  await nextTick()
  previewTrigger.value?.focus()
  previewTrigger.value = null
}

function movePreview(offset: number) {
  if (previewIndex.value === null || previewAttachments.value.length < 2) return
  previewIndex.value =
    (previewIndex.value + offset + previewAttachments.value.length) %
    previewAttachments.value.length
}

function handleLightboxKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    void closePreview()
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    movePreview(-1)
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    movePreview(1)
  }
}

function handleUploadedDescriptionUpdate(path: string, description: string) {
  emit('updateDescription', { path, description })
}

watch(previewImage, async (currentPreview) => {
  if (!currentPreview) return
  await nextTick()
  lightbox.value?.focus()
})
</script>

<template>
  <div class="image-upload-picker">
    <FileUpload
      ref="uploader"
      name="images[]"
      accept="image/*"
      :multiple="true"
      :auto="true"
      :customUpload="true"
      :maxFileSize="maxFileSize"
      :disabled="disabled || busy"
      class="image-upload-picker__uploader"
      @select="handleSelect"
      @uploader="handleUploader"
    >
      <template #header="{ chooseCallback }">
        <div class="image-upload-picker__header">
          <div v-if="!disabled" class="image-upload-picker__buttons">
            <AppButton
              class="image-upload-picker__icon-button"
              :aria-label="chooseLabel"
              :title="chooseLabel"
              :disabled="disabled || busy"
              @click="chooseCallback()"
            >
              <i class="pi pi-images" aria-hidden="true"></i>
            </AppButton>
          </div>

          <div v-if="!disabled && busy" class="image-upload-picker__progress-shell">
            <div class="image-upload-picker__progress-track">
              <div class="image-upload-picker__progress-value"></div>
            </div>
          </div>

          <span v-if="helperText" class="image-upload-picker__helper">{{ helperText }}</span>
        </div>
      </template>

      <template #content="{ messages }">
        <div class="image-upload-picker__content">
          <div
            v-for="message in normalizeMessages(messages)"
            :key="message"
            class="image-upload-picker__message"
          >
            {{ message }}
          </div>

          <section v-if="attachments.length" class="image-upload-picker__section">
            <div class="image-upload-picker__grid">
              <AppCard
                v-for="attachment in attachments"
                :key="attachment.path"
                as="article"
                class="image-upload-picker__card"
              >
                <button
                  type="button"
                  class="image-upload-picker__preview-button"
                  :aria-label="`View ${attachment.name}`"
                  :title="`View ${attachment.name}`"
                  @click="openPreview(attachment.path)"
                >
                  <img
                    :src="attachment.url"
                    :alt="attachment.name"
                    loading="lazy"
                    decoding="async"
                  />
                </button>

                <span class="image-upload-picker__name">{{ attachment.name }}</span>
                <div class="image-upload-picker__meta">
                  {{ disabled ? 'Attached photo' : 'Saved to draft' }}
                </div>

                <label v-if="!disabled" class="image-upload-picker__field">
                  <span>{{ descriptionLabel }}</span>
                  <AppTextarea
                    :model-value="attachment.description"
                    rows="3"
                    :disabled="disabled || busy"
                    :placeholder="descriptionLabel"
                    @update:model-value="handleUploadedDescriptionUpdate(attachment.path, $event)"
                    @blur="emit('commitDescription')"
                  />
                </label>

                <div
                  v-else-if="attachment.description"
                  class="image-upload-picker__readonly-description"
                >
                  <strong>{{ descriptionLabel }}</strong>
                  <span>{{ attachment.description }}</span>
                </div>

                <AppButton
                  v-if="!disabled"
                  class="image-upload-picker__remove"
                  variant="danger"
                  :disabled="disabled || busy"
                  @click="emit('remove', attachment.path)"
                >
                  Delete
                </AppButton>
              </AppCard>
            </div>
          </section>

          <div v-else-if="!busy" class="image-upload-picker__empty">
            <div class="image-upload-picker__empty-icon">
              <i class="pi pi-cloud-upload" aria-hidden="true"></i>
            </div>
            <p>{{ disabled ? 'No photos were attached.' : emptyLabel }}</p>
            <span v-if="!disabled">{{ chooseLabel }}</span>
          </div>
        </div>
      </template>
    </FileUpload>

    <div
      v-if="previewImage"
      ref="lightbox"
      class="image-upload-picker__lightbox"
      role="dialog"
      aria-modal="true"
      :aria-label="`Photo viewer: ${previewImage.name}`"
      tabindex="-1"
      @click.self="closePreview"
      @keydown="handleLightboxKeydown"
    >
      <AppButton
        class="image-upload-picker__lightbox-close"
        aria-label="Close photo viewer"
        title="Close photo viewer"
        @click="closePreview"
      >
        <i class="pi pi-times" aria-hidden="true"></i>
      </AppButton>

      <AppButton
        v-if="previewAttachments.length > 1"
        class="image-upload-picker__lightbox-previous image-upload-picker__lightbox-navigation"
        aria-label="Previous photo"
        title="Previous photo"
        @click="movePreview(-1)"
      >
        <i class="pi pi-chevron-left" aria-hidden="true"></i>
      </AppButton>

      <div class="image-upload-picker__lightbox-body">
        <img
          class="image-upload-picker__lightbox-image"
          :src="previewImage.url"
          :alt="previewImage.name"
        />
        <div class="image-upload-picker__lightbox-caption">
          <strong>{{ previewImage.name }}</strong>
          <span v-if="previewImage.description">{{ previewImage.description }}</span>
          <small>{{ previewPosition }} of {{ previewAttachments.length }}</small>
        </div>
      </div>

      <AppButton
        v-if="previewAttachments.length > 1"
        class="image-upload-picker__lightbox-next image-upload-picker__lightbox-navigation"
        aria-label="Next photo"
        title="Next photo"
        @click="movePreview(1)"
      >
        <i class="pi pi-chevron-right" aria-hidden="true"></i>
      </AppButton>
    </div>
  </div>
</template>

<style scoped>
.image-upload-picker {
  position: relative;
}

.image-upload-picker__uploader {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-sm);
  background: var(--field);
}

.image-upload-picker :deep(input[type='file']) {
  display: none;
}

.image-upload-picker__header {
  display: grid;
  gap: 0.9rem;
}

.image-upload-picker__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.image-upload-picker__icon-button {
  width: 2.9rem;
  min-width: 2.9rem;
  padding: 0;
}

.image-upload-picker__progress-shell {
  display: grid;
  gap: 0.45rem;
}

.image-upload-picker__progress-track {
  overflow: hidden;
  height: 0.95rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.image-upload-picker__progress-value {
  height: 100%;
  width: 36%;
  border-radius: inherit;
  background: var(--button-primary);
  animation: image-upload-picker-progress 1.15s ease-in-out infinite;
}

.image-upload-picker__content {
  display: grid;
  gap: 1rem;
}

.image-upload-picker__helper {
  color: var(--text-muted);
  font-size: 0.82rem;
}

.image-upload-picker__message {
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(255, 125, 107, 0.24);
  border-radius: var(--radius-sm);
  color: var(--danger);
  background: rgba(255, 125, 107, 0.08);
}

.image-upload-picker__section {
  display: grid;
  gap: 0.85rem;
}

.image-upload-picker__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
}

.image-upload-picker__card {
  --app-card-gap: 0.55rem;
  --app-card-padding: 0.75rem;
  --app-card-border: 1px solid rgba(255, 255, 255, 0.08);
  --app-card-radius: var(--radius-sm);
  --app-card-background: rgba(255, 255, 255, 0.03);
  --app-card-shadow: none;
  flex: 0 1 220px;
  width: min(100%, 220px);
}

.image-upload-picker__preview-button {
  display: grid;
  place-items: center;
  width: 100%;
  height: 118px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--field);
  cursor: pointer;
}

.image-upload-picker__preview-button img {
  display: block;
  max-width: calc(100% - 0.75rem);
  max-height: calc(100% - 0.75rem);
  width: auto;
  height: auto;
  object-fit: contain;
}

.image-upload-picker__name {
  font-weight: 600;
  line-height: 1.25;
  overflow: hidden;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.image-upload-picker__meta {
  color: var(--text-muted);
  font-size: 0.77rem;
}

.image-upload-picker__field {
  --app-textarea-min-height: 3.35rem;
  --app-textarea-padding: 0.6rem 0.75rem;
  --app-textarea-background: rgba(255, 255, 255, 0.045);
  display: grid;
  gap: 0.3rem;
  color: var(--text-muted);
}

.image-upload-picker__field span {
  font-size: 0.78rem;
}

.image-upload-picker__readonly-description {
  display: grid;
  gap: 0.25rem;
  color: var(--text-muted);
  font-size: 0.82rem;
  line-height: 1.4;
  white-space: pre-wrap;
}

.image-upload-picker__readonly-description strong {
  color: var(--text-soft);
}

.image-upload-picker__empty {
  display: grid;
  place-items: center;
  gap: 0.65rem;
  min-height: 13rem;
  padding: 1rem;
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  text-align: center;
  color: var(--text-muted);
}

.image-upload-picker__empty-icon {
  display: grid;
  place-items: center;
  width: 5.5rem;
  height: 5.5rem;
  border: 2px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  font-size: 2rem;
  color: var(--text-soft);
}

.image-upload-picker__remove {
  justify-self: stretch;
  min-height: 2.4rem;
  padding-top: 0;
  padding-bottom: 0;
}

.image-upload-picker__lightbox {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 2rem;
  background: rgba(4, 10, 16, 0.82);
  outline: none;
}

.image-upload-picker__lightbox-close {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  width: 2.9rem;
  min-width: 2.9rem;
  padding: 0;
}

.image-upload-picker__lightbox-navigation {
  position: absolute;
  top: 50%;
  width: 3.25rem;
  min-width: 3.25rem;
  padding: 0;
  transform: translateY(-50%);
}

.image-upload-picker__lightbox-previous {
  left: 1.5rem;
}

.image-upload-picker__lightbox-next {
  right: 1.5rem;
}

.image-upload-picker__lightbox-body {
  display: grid;
  gap: 0.75rem;
  justify-items: center;
  max-width: min(92vw, 1100px);
}

.image-upload-picker__lightbox-image {
  display: block;
  max-width: 100%;
  max-height: 82vh;
  border-radius: var(--radius-sm);
  box-shadow: none;
}

.image-upload-picker__lightbox-caption {
  display: grid;
  gap: 0.25rem;
  max-width: min(90vw, 48rem);
  text-align: center;
  color: #f0f6fb;
  line-height: 1.4;
  white-space: pre-wrap;
}

.image-upload-picker__lightbox-caption strong {
  font-weight: 700;
}

.image-upload-picker__lightbox-caption span,
.image-upload-picker__lightbox-caption small {
  color: rgba(240, 246, 251, 0.78);
}

@keyframes image-upload-picker-progress {
  0% {
    transform: translateX(-110%);
  }

  100% {
    transform: translateX(285%);
  }
}

@media (max-width: 720px) {
  .image-upload-picker__grid {
    display: grid;
    grid-template-columns: 1fr;
  }

  .image-upload-picker__buttons {
    width: 100%;
  }

  .image-upload-picker__card {
    width: 100%;
  }

  .image-upload-picker__lightbox {
    padding: 4.75rem 0.75rem 5.25rem;
  }

  .image-upload-picker__lightbox-close {
    top: 1rem;
    right: 1rem;
  }

  .image-upload-picker__lightbox-image {
    max-height: 68vh;
  }

  .image-upload-picker__lightbox-navigation {
    top: auto;
    bottom: 1rem;
    transform: none;
  }

  .image-upload-picker__lightbox-previous {
    left: calc(50% - 4rem);
  }

  .image-upload-picker__lightbox-next {
    right: calc(50% - 4rem);
  }
}
</style>
