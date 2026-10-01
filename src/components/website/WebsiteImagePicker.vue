<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { uploadWebsiteImage, websiteCommand, websiteError } from '@/services/website'
import type { WebsiteAsset } from '@/features/website/types'
import WebsiteImage from './WebsiteImage.vue'
const props = defineProps<{ imageId: string; alt: string; logo?: boolean; compact?: boolean }>()
const emit = defineEmits<{
  update: [value: { imageId: string; alt: string }]
  uploading: [busy: boolean]
}>()
const busy = ref(false)
const error = ref('')
const dialog = ref<HTMLDialogElement>()
const libraryButton = ref<HTMLButtonElement>()
const images = ref<WebsiteAsset[]>([])
const cursor = ref<string | null>(null)
const loading = ref(false)
const libraryError = ref('')
const search = ref('')
let generation = 0
let mounted = true
const filtered = computed(() =>
  images.value.filter((image) =>
    image.name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()),
  ),
)
onBeforeUnmount(() => {
  mounted = false
  generation++
  dialog.value?.close()
})
async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  busy.value = true
  emit('uploading', true)
  error.value = ''
  try {
    const image = await uploadWebsiteImage(file)
    if (mounted) emit('update', { imageId: image.id, alt: '' })
  } catch (reason) {
    if (mounted) error.value = websiteError(reason)
  } finally {
    busy.value = false
    emit('uploading', false)
    input.value = ''
  }
}
async function loadImages() {
  const request = ++generation
  loading.value = true
  libraryError.value = ''
  try {
    const result = await websiteCommand<{ images: WebsiteAsset[]; nextCursor: string | null }>(
      'listImages',
      cursor.value ? { cursor: cursor.value } : {},
    )
    if (request !== generation) return
    images.value.push(
      ...result.images.filter(
        (image) => !images.value.some((existing) => existing.id === image.id),
      ),
    )
    cursor.value = result.nextCursor
  } catch (reason) {
    if (request === generation) libraryError.value = websiteError(reason)
  } finally {
    if (request === generation) loading.value = false
  }
}
function openLibrary() {
  images.value = []
  cursor.value = null
  search.value = ''
  dialog.value?.showModal()
  void loadImages()
}
function closeLibrary() {
  generation++
  loading.value = false
  dialog.value?.close()
  void nextTick(() => libraryButton.value?.focus({ preventScroll: true }))
}
function select(id: string) {
  emit('update', { imageId: id, alt: id === props.imageId ? props.alt : '' })
  closeLibrary()
}
</script>
<template>
  <div class="image-picker">
    <div v-if="imageId && !compact" class="image-sample">
      <WebsiteImage :id="imageId" :alt="alt" preview thumbnail :contain="logo" />
    </div>
    <div class="image-actions">
      <button ref="libraryButton" type="button" :disabled="busy" @click="openLibrary">
        Choose {{ logo ? 'logo' : 'image' }} from library</button
      ><button
        v-if="imageId"
        type="button"
        :disabled="busy"
        @click="emit('update', { imageId: '', alt: '' })"
      >
        Remove {{ logo ? 'logo' : 'image' }}
      </button>
    </div>
    <label
      >{{ logo ? 'Upload logo' : imageId ? 'Replace image' : 'Upload image'
      }}<input type="file" accept=".jpg,.jpeg,.png,.webp" :disabled="busy" @change="upload"
    /></label>
    <small>JPG, PNG or WebP, up to 5 MB. New uploads are also saved in your image library.</small>
    <p v-if="busy" role="status">Uploading image…</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <label v-if="imageId"
      >{{ logo ? 'Logo description' : 'Image description'
      }}<input
        :value="alt"
        maxlength="300"
        @input="emit('update', { imageId, alt: ($event.target as HTMLInputElement).value })"
    /></label>
    <Teleport to="body"
      ><dialog
        ref="dialog"
        class="builder-controls builder-dialog image-library-dialog"
        aria-label="Website image library"
        data-selection-inspector
        @cancel.prevent="closeLibrary"
        @keydown.esc.prevent.stop="closeLibrary"
      >
        <header>
          <div>
            <h2>Image library</h2>
            <p>Choose an existing image. It becomes public only when used on a published page.</p>
          </div>
          <button type="button" aria-label="Close image library" @click="closeLibrary">×</button>
        </header>
        <div class="image-library-body">
          <div class="image-library-search">
            <label
              >Search loaded images<input v-model="search" type="search" placeholder="File name"
            /></label>
            <button
              v-if="search"
              type="button"
              aria-label="Clear image search"
              @click="search = ''"
            >
              Clear
            </button>
          </div>
          <p v-if="libraryError" role="alert">
            {{ libraryError }}
            <button type="button" :disabled="loading" @click="loadImages">Try again</button>
          </p>
          <div class="image-grid">
            <button
              v-for="asset in filtered"
              :key="asset.id"
              type="button"
              :aria-label="`Use ${asset.name}`"
              :aria-pressed="asset.id === imageId"
              @click="select(asset.id)"
            >
              <div class="library-thumb">
                <WebsiteImage :id="asset.id" :alt="asset.name" preview thumbnail />
              </div>
              <span>{{ asset.name }}</span
              ><small>{{ Math.max(1, Math.round(asset.size / 1024)) }} KB</small>
              <small v-if="asset.id === imageId">Current image</small>
            </button>
          </div>
          <p v-if="loading" role="status">Loading images…</p>
          <p v-else-if="!filtered.length && !libraryError">
            {{
              images.length
                ? 'No matching loaded images.'
                : 'No images yet. Close the library to upload your first image.'
            }}
          </p>
        </div>
        <footer>
          <span>{{ images.length }} images loaded</span
          ><button v-if="cursor" type="button" :disabled="loading" @click="loadImages">
            Load more images</button
          ><button type="button" @click="closeLibrary">Cancel</button>
        </footer>
      </dialog></Teleport
    >
  </div>
</template>
<style scoped>
.image-picker,
label {
  display: grid;
  gap: 0.4rem;
}
.image-picker {
  gap: 0.7rem;
}
.image-sample {
  height: 120px;
  overflow: hidden;
}
.image-actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
label,
small {
  font-size: 0.8rem;
}
input {
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  padding: 0.55rem;
  color: var(--text);
  background: var(--field);
  border: 1px solid var(--border);
  border-radius: 4px;
}
button {
  background: var(--field);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.5rem;
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
[role='alert'] {
  color: var(--danger);
}
dialog {
  width: min(760px, calc(100vw - 40px));
  max-height: 80vh;
  box-sizing: border-box;
  padding: 1.2rem;
  color: var(--text);
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 10px;
}
dialog::backdrop {
  background: #0009;
}
header,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
h2 {
  font-size: 1.3rem;
  margin: 0;
}
header p {
  font-size: 0.85rem;
  color: var(--text-muted);
}
footer {
  margin-top: 1rem;
  font-size: 0.85rem;
  flex-wrap: wrap;
}
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.8rem;
  margin-top: 1rem;
}
.image-grid button {
  text-align: left;
  min-width: 0;
}
.image-grid span,
.image-grid small {
  display: block;
  overflow-wrap: anywhere;
  margin-top: 0.3rem;
}
.library-thumb {
  height: 110px;
  overflow: hidden;
}
</style>
