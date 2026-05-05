<script setup lang="ts">
import { ref } from 'vue'
import FileUpload, { type FileUploadSelectEvent, type FileUploadUploaderEvent } from 'primevue/fileupload'
import type { DailyLogAttachmentRecord } from '@/types/domain'

export interface ImageUploadEntry {
  file: File
  description: string
}

const props = withDefaults(defineProps<{
  attachments: DailyLogAttachmentRecord[]
  chooseLabel?: string
  descriptionLabel?: string
  emptyLabel?: string
  helperText?: string
  disabled?: boolean
  busy?: boolean
  maxFileSize?: number
  uploadHandler: (entries: ImageUploadEntry[]) => Promise<void>
}>(), {
  chooseLabel: 'Choose Images',
  descriptionLabel: 'Description',
  emptyLabel: 'Drag and drop files here to upload.',
  helperText: 'Choose one or more images. Use the image button again to add more.',
  disabled: false,
  busy: false,
  maxFileSize: 10 * 1024 * 1024,
})

const emit = defineEmits<{
  updateDescription: [payload: { path: string; description: string }]
  commitDescription: []
  remove: [path: string]
}>()

const uploader = ref<{ clear: () => void } | null>(null)
const localMessages = ref<string[]>([])
const previewImage = ref<{ src: string; name: string } | null>(null)

function toFiles(files: unknown) {
  if (Array.isArray(files)) return files as File[]
  return files instanceof File ? [files] : []
}

function handleSelect(_event: FileUploadSelectEvent) {
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

function openPreview(src: string | undefined, name: string) {
  if (!src) return
  previewImage.value = { src, name }
}

function closePreview() {
  previewImage.value = null
}

function handleUploadedDescriptionInput(path: string, event: Event) {
  const value = event.target instanceof HTMLTextAreaElement ? event.target.value : ''
  emit('updateDescription', { path, description: value })
}
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
          <div class="image-upload-picker__buttons">
            <button
              type="button"
              class="app-button image-upload-picker__icon-button"
              :disabled="disabled || busy"
              @click="chooseCallback()"
            >
              <i class="pi pi-images" aria-hidden="true"></i>
            </button>
          </div>

          <div
            v-if="busy"
            class="image-upload-picker__progress-shell"
          >
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
              <article
                v-for="attachment in attachments"
                :key="attachment.path"
                class="image-upload-picker__card"
              >
                <button
                  type="button"
                  class="image-upload-picker__preview-button"
                  @click="openPreview(attachment.url, attachment.name)"
                >
                  <img :src="attachment.url" :alt="attachment.name" />
                </button>

                <span class="image-upload-picker__name">{{ attachment.name }}</span>
                <div class="image-upload-picker__meta">Saved to draft</div>

                <label class="image-upload-picker__field">
                  <span>{{ descriptionLabel }}</span>
                  <textarea
                    :value="attachment.description"
                    rows="3"
                    :disabled="disabled || busy"
                    :placeholder="descriptionLabel"
                    @input="handleUploadedDescriptionInput(attachment.path, $event)"
                    @blur="emit('commitDescription')"
                  ></textarea>
                </label>

                <button
                  type="button"
                  class="app-button image-upload-picker__remove"
                  :disabled="disabled || busy"
                  @click="emit('remove', attachment.path)"
                >
                  Delete
                </button>
              </article>
            </div>
          </section>

          <div
            v-else-if="!busy"
            class="image-upload-picker__empty"
          >
            <div class="image-upload-picker__empty-icon">
              <i class="pi pi-cloud-upload" aria-hidden="true"></i>
            </div>
            <p>{{ emptyLabel }}</p>
            <span>{{ chooseLabel }}</span>
          </div>
        </div>
      </template>
    </FileUpload>

    <div v-if="previewImage" class="image-upload-picker__lightbox" @click.self="closePreview">
      <button
        type="button"
        class="app-button image-upload-picker__lightbox-close"
        @click="closePreview"
      >
        <i class="pi pi-times" aria-hidden="true"></i>
      </button>

      <div class="image-upload-picker__lightbox-body">
        <img
          class="image-upload-picker__lightbox-image"
          :src="previewImage.src"
          :alt="previewImage.name"
        />
        <span class="image-upload-picker__lightbox-caption">{{ previewImage.name }}</span>
      </div>
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
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.02);
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

.image-upload-picker__remove {
  border-color: rgba(255, 125, 107, 0.24);
  color: var(--danger);
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
  background: linear-gradient(90deg, rgba(88, 186, 233, 0.9), rgba(103, 213, 157, 0.9));
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
  border-radius: 12px;
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
  display: grid;
  flex: 0 1 220px;
  gap: 0.55rem;
  width: min(100%, 220px);
  padding: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
}

.image-upload-picker__preview-button {
  display: grid;
  place-items: center;
  width: 100%;
  height: 118px;
  padding: 0;
  border: 0;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.03);
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
  display: grid;
  gap: 0.3rem;
  color: var(--text-muted);
}

.image-upload-picker__field span {
  font-size: 0.78rem;
}

.image-upload-picker__field textarea {
  width: 100%;
  min-height: 3.35rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.045);
  color: var(--text);
  resize: vertical;
}

.image-upload-picker__empty {
  display: grid;
  place-items: center;
  gap: 0.65rem;
  min-height: 13rem;
  padding: 1rem;
  border: 1px dashed var(--border);
  border-radius: 14px;
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
  backdrop-filter: blur(6px);
}

.image-upload-picker__lightbox-close {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  width: 2.9rem;
  min-width: 2.9rem;
  padding: 0;
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
  border-radius: 16px;
  box-shadow: 0 22px 50px rgba(0, 0, 0, 0.35);
}

.image-upload-picker__lightbox-caption {
  color: #f0f6fb;
  font-weight: 600;
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
}
</style>
