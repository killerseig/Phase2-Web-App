<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppPageLayout from '@/components/common/AppPageLayout.vue'
import '@/styles/brand-workspace.css'
import {
  fetchLegacyPublicDailyLogGallery,
  fetchPublicDailyLogGallery,
} from '@/services/dailyLogGallery'
import type { DailyLogAttachmentRecord, PublicDailyLogGalleryRecord } from '@/types/domain'

type GallerySectionKey = 'photo' | 'ptp' | 'qc'
type GalleryPhoto = Pick<
  DailyLogAttachmentRecord,
  'name' | 'url' | 'thumbnailUrl' | 'type' | 'description'
>

interface GallerySection {
  key: GallerySectionKey
  title: string
  photos: GalleryPhoto[]
}

const route = useRoute()
const gallery = ref<PublicDailyLogGalleryRecord | null>(null)
const loading = ref(true)
const errorMessage = ref('')
const activePhotoSectionKey = ref<GallerySectionKey | null>(null)
const activePhotoIndex = ref<number | null>(null)
const lightbox = ref<HTMLElement | null>(null)
const currentYear = new Date().getFullYear()

const gallerySections = computed<GallerySection[]>(() => {
  const attachments = gallery.value?.attachments ?? []
  const sections: Array<{ key: GallerySectionKey; title: string }> = [
    { key: 'photo', title: 'Photos' },
    { key: 'ptp', title: 'PTP Photos' },
    { key: 'qc', title: 'QC Photos' },
  ]

  return sections.flatMap((section) => {
    const photos = attachments.filter((photo) => {
      if (section.key === 'photo') return photo.type !== 'ptp' && photo.type !== 'qc'
      return photo.type === section.key
    })
    return photos.length ? [{ ...section, photos }] : []
  })
})
const activePhotoSection = computed(() =>
  gallerySections.value.find((section) => section.key === activePhotoSectionKey.value),
)
const activePhoto = computed(() => {
  if (activePhotoIndex.value === null) return null
  return activePhotoSection.value?.photos[activePhotoIndex.value] ?? null
})
const photoPosition = computed(() => (activePhotoIndex.value ?? 0) + 1)
const jobLabel = computed(() => {
  if (!gallery.value) return 'Daily Log Photos'
  return gallery.value.jobCode
    ? `${gallery.value.jobName} (#${gallery.value.jobCode})`
    : gallery.value.jobName
})
const formattedLogDate = computed(() => {
  const value = gallery.value?.logDate
  if (!value) return 'Date unavailable'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
})

function readShareId() {
  return typeof route.params.shareId === 'string' ? route.params.shareId : ''
}

function readLegacyRouteParams() {
  return {
    jobId: typeof route.params.jobId === 'string' ? route.params.jobId : '',
    dailyLogId: typeof route.params.dailyLogId === 'string' ? route.params.dailyLogId : '',
  }
}

async function loadGallery() {
  loading.value = true
  errorMessage.value = ''
  try {
    if (route.name === 'daily-log-gallery-legacy') {
      const { jobId, dailyLogId } = readLegacyRouteParams()
      gallery.value = await fetchLegacyPublicDailyLogGallery(jobId, dailyLogId)
    } else {
      gallery.value = await fetchPublicDailyLogGallery(readShareId())
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'This photo gallery is unavailable.'
  } finally {
    loading.value = false
  }

  if (gallery.value && !errorMessage.value) await applyGalleryHash()
}

async function openPhoto(sectionKey: GallerySectionKey, index: number) {
  activePhotoSectionKey.value = sectionKey
  activePhotoIndex.value = index
  await nextTick()
  lightbox.value?.focus()
}

function closePhoto() {
  activePhotoSectionKey.value = null
  activePhotoIndex.value = null
}

function movePhoto(offset: number) {
  const total = activePhotoSection.value?.photos.length ?? 0
  if (activePhotoIndex.value === null || total < 2) return
  activePhotoIndex.value = (activePhotoIndex.value + offset + total) % total
}

async function applyGalleryHash() {
  const match = /^#gallery-(photo|ptp|qc)(?:-(\d+))?$/.exec(route.hash)
  if (!match) return

  const sectionKey = match[1] as GallerySectionKey
  const section = gallerySections.value.find((entry) => entry.key === sectionKey)
  if (!section) return

  const requestedPosition = match[2] ? Number(match[2]) : null
  if (
    requestedPosition !== null &&
    requestedPosition >= 1 &&
    requestedPosition <= section.photos.length
  ) {
    await openPhoto(sectionKey, requestedPosition - 1)
    return
  }

  await nextTick()
  document.getElementById(`gallery-${sectionKey}`)?.scrollIntoView({ block: 'start' })
}

function handleKeydown(event: KeyboardEvent) {
  if (!activePhoto.value) return
  if (event.key === 'Escape') closePhoto()
  if (event.key === 'ArrowLeft') movePhoto(-1)
  if (event.key === 'ArrowRight') movePhoto(1)
}

onMounted(() => {
  void loadGallery()
  window.addEventListener('keydown', handleKeydown)
})

watch(
  () => route.hash,
  () => {
    if (!loading.value && gallery.value) void applyGalleryHash()
  },
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="daily-log-gallery public-page" data-testid="public-daily-log-gallery">
    <header class="daily-log-gallery__masthead">
      <div class="daily-log-gallery__brand-mark" aria-hidden="true">P2</div>
      <div>
        <strong>Phase 2</strong>
        <span>Daily Log Photo Gallery</span>
      </div>
    </header>

    <main class="daily-log-gallery__main">
      <div v-if="loading" class="daily-log-gallery__state" role="status">
        Loading photo gallery...
      </div>

      <div
        v-else-if="errorMessage"
        class="daily-log-gallery__state daily-log-gallery__state--error"
      >
        <h1>Gallery unavailable</h1>
        <p>{{ errorMessage }}</p>
      </div>

      <AppPageLayout
        v-else-if="gallery"
        class="daily-log-gallery__document"
        :title="jobLabel"
        eyebrow="Submitted Daily Log"
        description="Daily Log Photos"
      >
        <div class="daily-log-gallery__header">
          <dl class="daily-log-gallery__details">
            <div>
              <dt>Log Date</dt>
              <dd>{{ formattedLogDate }}</dd>
            </div>
            <div>
              <dt>Foreman</dt>
              <dd>{{ gallery.foremanName }}</dd>
            </div>
            <div>
              <dt>Daily Log</dt>
              <dd>#{{ gallery.sequenceNumber }}</dd>
            </div>
            <div>
              <dt>Photos</dt>
              <dd>{{ gallery.attachments.length }}</dd>
            </div>
          </dl>
        </div>

        <nav
          v-if="gallerySections.length > 1"
          class="daily-log-gallery__section-nav"
          aria-label="Photo sections"
        >
          <a
            v-for="section in gallerySections"
            :key="section.key"
            :href="`#gallery-${section.key}`"
          >
            {{ section.title }} ({{ section.photos.length }})
          </a>
        </nav>

        <template v-if="gallerySections.length">
          <section
            v-for="section in gallerySections"
            :id="`gallery-${section.key}`"
            :key="section.key"
            class="daily-log-gallery__photos"
            :data-testid="`gallery-section-${section.key}`"
            :aria-labelledby="`gallery-${section.key}-title`"
          >
            <div class="daily-log-gallery__section-heading">
              <h2 :id="`gallery-${section.key}-title`">{{ section.title }}</h2>
              <span>{{ section.photos.length }} · Select a photo to view it larger.</span>
            </div>

            <div class="daily-log-gallery__grid">
              <figure
                v-for="(photo, index) in section.photos"
                :id="`gallery-${section.key}-${index + 1}`"
                :key="`${photo.url}-${index}`"
                class="daily-log-gallery__photo"
              >
                <button
                  type="button"
                  class="daily-log-gallery__photo-button"
                  :aria-label="`View ${photo.name}`"
                  @click="openPhoto(section.key, index)"
                >
                  <img
                    :src="photo.thumbnailUrl || photo.url"
                    :alt="photo.name"
                    loading="lazy"
                    decoding="async"
                  />
                </button>
                <figcaption>
                  <strong>{{ photo.name }}</strong>
                  <span v-if="photo.description">{{ photo.description }}</span>
                </figcaption>
              </figure>
            </div>
          </section>
        </template>

        <section v-else class="daily-log-gallery__photos" aria-labelledby="gallery-empty-title">
          <h2 id="gallery-empty-title" class="sr-only">Photos</h2>
          <p class="daily-log-gallery__empty">No photos are attached to this daily log.</p>
        </section>
      </AppPageLayout>
    </main>

    <footer class="daily-log-gallery__footer">
      &copy; {{ currentYear }} Phase 2. All rights reserved.
    </footer>

    <div
      v-if="activePhoto"
      ref="lightbox"
      class="daily-log-gallery__lightbox"
      role="dialog"
      aria-modal="true"
      :aria-label="`Photo viewer: ${activePhoto.name}`"
      tabindex="-1"
      @click.self="closePhoto"
    >
      <div class="daily-log-gallery__lightbox-bar">
        <span>
          {{ activePhotoSection?.title }}: {{ photoPosition }} of
          {{ activePhotoSection?.photos.length ?? 0 }}
        </span>
        <button type="button" aria-label="Close photo viewer" @click="closePhoto">
          <i class="pi pi-times" aria-hidden="true"></i>
        </button>
      </div>

      <div class="daily-log-gallery__lightbox-stage">
        <button
          v-if="(activePhotoSection?.photos.length ?? 0) > 1"
          type="button"
          class="daily-log-gallery__lightbox-nav daily-log-gallery__lightbox-nav--previous"
          aria-label="Previous photo"
          @click="movePhoto(-1)"
        >
          <i class="pi pi-chevron-left" aria-hidden="true"></i>
        </button>

        <img :src="activePhoto.url" :alt="activePhoto.name" />

        <button
          v-if="(activePhotoSection?.photos.length ?? 0) > 1"
          type="button"
          class="daily-log-gallery__lightbox-nav daily-log-gallery__lightbox-nav--next"
          aria-label="Next photo"
          @click="movePhoto(1)"
        >
          <i class="pi pi-chevron-right" aria-hidden="true"></i>
        </button>
      </div>

      <div class="daily-log-gallery__lightbox-caption">
        <strong>{{ activePhoto.name }}</strong>
        <span v-if="activePhoto.description">{{ activePhoto.description }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.daily-log-gallery {
  height: 100%;
  min-height: 100dvh;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
  color: var(--text);
  background: var(--panel-background);
}

.daily-log-gallery__masthead,
.daily-log-gallery__main,
.daily-log-gallery__footer {
  width: min(100% - 2rem, 76rem);
  margin-inline: auto;
}

.daily-log-gallery__masthead {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-height: 4.5rem;
  border-bottom: 1px solid var(--border-soft);
}

.daily-log-gallery__brand-mark {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  background: var(--field);
  font-weight: var(--font-weight-heading);
}

.daily-log-gallery__masthead > div:last-child {
  display: grid;
  gap: 0.05rem;
}

.daily-log-gallery__masthead strong {
  font-size: var(--font-size-section-title);
  font-weight: var(--font-weight-heading);
}

.daily-log-gallery__masthead span {
  color: var(--text-muted);
  font-size: var(--font-size-eyebrow);
  letter-spacing: var(--letter-spacing-eyebrow);
  text-transform: uppercase;
}

.daily-log-gallery__main {
  padding-block: clamp(1rem, 3vw, 2rem);
}

.daily-log-gallery__state {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  box-shadow: none;
}

.daily-log-gallery__state {
  display: grid;
  place-items: center;
  min-height: 18rem;
  padding: 2rem;
  text-align: center;
  color: var(--text-muted);
}

.daily-log-gallery__state--error {
  align-content: center;
  gap: 0.5rem;
}

.daily-log-gallery__state h1,
.daily-log-gallery__state p {
  margin: 0;
}

.daily-log-gallery__header {
  padding: var(--page-panel-padding);
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel-background);
}

.daily-log-gallery__details {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
  margin: 0;
}

.daily-log-gallery__details div {
  min-width: 0;
  padding: 0;
}

.daily-log-gallery__details dt {
  color: var(--text-muted);
  font-size: var(--font-size-label);
}

.daily-log-gallery__details dd {
  overflow-wrap: anywhere;
  margin: 0.3rem 0 0;
  color: var(--text);
  font-weight: var(--font-weight-heading);
}

.daily-log-gallery__photos {
  padding: var(--page-panel-padding);
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel-background);
  scroll-margin-top: 1rem;
}

.daily-log-gallery__photos + .daily-log-gallery__photos {
  border-top: 1px solid var(--border-soft);
}

.daily-log-gallery__section-nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--list-gap);
  padding: 1rem clamp(1rem, 3vw, 2rem) 0;
}

.daily-log-gallery__section-nav a {
  padding: 0.55rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  background: var(--field);
  font-size: var(--font-size-sm);
  font-weight: 500;
  text-decoration: none;
}

.daily-log-gallery__section-nav a:hover,
.daily-log-gallery__lightbox button:hover {
  background: var(--field-hover);
}

.daily-log-gallery__section-nav a:focus-visible,
.daily-log-gallery__photo-button:focus-visible,
.daily-log-gallery__lightbox button:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: -1px;
}

.daily-log-gallery__section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.daily-log-gallery__section-heading h2 {
  margin: 0;
  font-size: var(--font-size-pane-title);
  font-weight: var(--font-weight-heading);
}

.daily-log-gallery__section-heading span {
  color: var(--text-muted);
  font-size: var(--font-size-help);
}

.daily-log-gallery__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
  gap: var(--space-4);
}

.daily-log-gallery__photo {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: transparent;
}

.daily-log-gallery__photo-button {
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 4 / 3;
  min-height: 0;
  overflow: hidden;
  padding: 0.5rem;
  border: 0;
  border-bottom: 1px solid var(--border-soft);
  background: var(--field);
  cursor: zoom-in;
}

.daily-log-gallery__photo-button img {
  display: block;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.daily-log-gallery__photo figcaption {
  display: grid;
  gap: 0.25rem;
  padding: 0.8rem 0.9rem;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.daily-log-gallery__photo figcaption span {
  color: var(--text-muted);
  font-size: var(--font-size-help);
  line-height: 1.4;
}

.daily-log-gallery__photo figcaption strong,
.daily-log-gallery__lightbox-caption strong {
  font-weight: var(--font-weight-heading);
}

.daily-log-gallery__empty {
  margin: 0;
  padding: 3rem 1rem;
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  text-align: center;
  color: var(--text-muted);
}

.daily-log-gallery__footer {
  padding: 0.2rem 0 1.5rem;
  color: var(--text-soft);
  font-size: var(--font-size-xs);
  text-align: center;
}

.daily-log-gallery__lightbox {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 0.75rem;
  min-width: 0;
  min-height: 0;
  padding: max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right))
    max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left));
  background: var(--bg-elevated);
  outline: none;
}

.daily-log-gallery__lightbox-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-muted);
  font-size: var(--font-size-help);
}

.daily-log-gallery__lightbox button {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  background: var(--field);
  cursor: pointer;
}

.daily-log-gallery__lightbox-stage {
  position: relative;
  display: grid;
  place-items: center;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.daily-log-gallery__lightbox-stage img {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.daily-log-gallery__lightbox-nav {
  position: absolute;
  top: 50%;
  z-index: 1;
  transform: translateY(-50%);
}

.daily-log-gallery__lightbox-nav--previous {
  left: 0.25rem;
}

.daily-log-gallery__lightbox-nav--next {
  right: 0.25rem;
}

.daily-log-gallery__lightbox-caption {
  display: grid;
  gap: 0.2rem;
  justify-items: center;
  max-height: 20dvh;
  overflow: auto;
  color: var(--text);
  text-align: center;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.daily-log-gallery__lightbox-caption span {
  color: var(--text-muted);
  font-size: var(--font-size-help);
}

@media (max-width: 700px) {
  .daily-log-gallery__masthead,
  .daily-log-gallery__main,
  .daily-log-gallery__footer {
    width: min(100% - 1rem, 76rem);
  }

  .daily-log-gallery__details {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .daily-log-gallery__section-heading {
    display: grid;
    gap: 0.25rem;
  }

  .daily-log-gallery__grid {
    grid-template-columns: 1fr;
  }

  .daily-log-gallery__photo-button {
    aspect-ratio: auto;
    min-height: 12rem;
    max-height: 70dvh;
  }

  .daily-log-gallery__photo-button img {
    width: auto;
    height: auto;
    max-width: 100%;
    max-height: 68dvh;
  }
}

@media (max-width: 420px) {
  .daily-log-gallery__details {
    grid-template-columns: 1fr;
  }
}
</style>
