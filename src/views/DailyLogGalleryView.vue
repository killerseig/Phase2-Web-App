<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  fetchLegacyPublicDailyLogGallery,
  fetchPublicDailyLogGallery,
} from '@/services/dailyLogGallery'
import type { PublicDailyLogGalleryRecord } from '@/types/domain'

const route = useRoute()
const gallery = ref<PublicDailyLogGalleryRecord | null>(null)
const loading = ref(true)
const errorMessage = ref('')
const activePhotoIndex = ref<number | null>(null)
const lightbox = ref<HTMLElement | null>(null)
const currentYear = new Date().getFullYear()

const activePhoto = computed(() => {
  if (activePhotoIndex.value === null) return null
  return gallery.value?.attachments[activePhotoIndex.value] ?? null
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
    dailyLogId:
      typeof route.params.dailyLogId === 'string' ? route.params.dailyLogId : '',
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
}

async function openPhoto(index: number) {
  activePhotoIndex.value = index
  await nextTick()
  lightbox.value?.focus()
}

function closePhoto() {
  activePhotoIndex.value = null
}

function movePhoto(offset: number) {
  const total = gallery.value?.attachments.length ?? 0
  if (activePhotoIndex.value === null || total < 2) return
  activePhotoIndex.value = (activePhotoIndex.value + offset + total) % total
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

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="daily-log-gallery" data-testid="public-daily-log-gallery">
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

      <div v-else-if="errorMessage" class="daily-log-gallery__state daily-log-gallery__state--error">
        <h1>Gallery unavailable</h1>
        <p>{{ errorMessage }}</p>
      </div>

      <article v-else-if="gallery" class="daily-log-gallery__document">
        <header class="daily-log-gallery__header">
          <span class="daily-log-gallery__eyebrow">Submitted Daily Log</span>
          <h1>{{ jobLabel }}</h1>
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
        </header>

        <section class="daily-log-gallery__photos" aria-labelledby="gallery-photos-title">
          <div class="daily-log-gallery__section-heading">
            <h2 id="gallery-photos-title">Photos</h2>
            <span>Select a photo to view it larger.</span>
          </div>

          <div v-if="gallery.attachments.length" class="daily-log-gallery__grid">
            <figure
              v-for="(photo, index) in gallery.attachments"
              :key="`${photo.url}-${index}`"
              class="daily-log-gallery__photo"
            >
              <button
                type="button"
                class="daily-log-gallery__photo-button"
                :aria-label="`View ${photo.name}`"
                @click="openPhoto(index)"
              >
                <img :src="photo.url" :alt="photo.name" loading="lazy" decoding="async" />
              </button>
              <figcaption>
                <strong>{{ photo.name }}</strong>
                <span v-if="photo.description">{{ photo.description }}</span>
              </figcaption>
            </figure>
          </div>

          <p v-else class="daily-log-gallery__empty">No photos are attached to this daily log.</p>
        </section>
      </article>
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
        <span>{{ photoPosition }} of {{ gallery?.attachments.length ?? 0 }}</span>
        <button type="button" aria-label="Close photo viewer" @click="closePhoto">
          <i class="pi pi-times" aria-hidden="true"></i>
        </button>
      </div>

      <div class="daily-log-gallery__lightbox-stage">
        <button
          v-if="(gallery?.attachments.length ?? 0) > 1"
          type="button"
          class="daily-log-gallery__lightbox-nav daily-log-gallery__lightbox-nav--previous"
          aria-label="Previous photo"
          @click="movePhoto(-1)"
        >
          <i class="pi pi-chevron-left" aria-hidden="true"></i>
        </button>

        <img :src="activePhoto.url" :alt="activePhoto.name" />

        <button
          v-if="(gallery?.attachments.length ?? 0) > 1"
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
  background:
    radial-gradient(circle at 16% 0%, rgba(99, 199, 230, 0.16), transparent 32rem),
    linear-gradient(180deg, #132330 0%, #0b151e 100%);
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
  border-bottom: 1px solid rgba(168, 190, 209, 0.16);
}

.daily-log-gallery__brand-mark {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border: 1px solid rgba(145, 220, 255, 0.38);
  border-radius: 13px;
  color: var(--accent-strong);
  background: rgba(99, 199, 230, 0.12);
  font-weight: 800;
  letter-spacing: 0.08em;
}

.daily-log-gallery__masthead > div:last-child {
  display: grid;
  gap: 0.05rem;
}

.daily-log-gallery__masthead strong {
  font-size: 1.05rem;
}

.daily-log-gallery__masthead span {
  color: var(--text-soft);
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.daily-log-gallery__main {
  padding-block: clamp(1rem, 3vw, 2rem);
}

.daily-log-gallery__document,
.daily-log-gallery__state {
  overflow: hidden;
  border: 1px solid rgba(168, 190, 209, 0.18);
  border-radius: 20px;
  background: rgba(28, 44, 58, 0.94);
  box-shadow: 0 24px 70px rgba(1, 8, 14, 0.3);
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
  padding: clamp(1.25rem, 4vw, 2.5rem);
  border-bottom: 1px solid rgba(168, 190, 209, 0.14);
  background:
    radial-gradient(circle at 90% 0%, rgba(99, 199, 230, 0.12), transparent 24rem),
    rgba(255, 255, 255, 0.015);
}

.daily-log-gallery__eyebrow {
  color: var(--accent);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.daily-log-gallery__header h1 {
  margin: 0.45rem 0 1.4rem;
  font-size: clamp(1.55rem, 4vw, 2.6rem);
  line-height: 1.08;
  letter-spacing: -0.04em;
}

.daily-log-gallery__details {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem;
  margin: 0;
}

.daily-log-gallery__details div {
  min-width: 0;
  padding: 0.8rem 0.9rem;
  border: 1px solid rgba(168, 190, 209, 0.13);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.025);
}

.daily-log-gallery__details dt {
  color: var(--text-soft);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.daily-log-gallery__details dd {
  overflow-wrap: anywhere;
  margin: 0.3rem 0 0;
  color: var(--text);
  font-weight: 650;
}

.daily-log-gallery__photos {
  padding: clamp(1rem, 3vw, 2rem);
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
  font-size: 1.15rem;
}

.daily-log-gallery__section-heading span {
  color: var(--text-muted);
  font-size: 0.82rem;
}

.daily-log-gallery__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
  gap: 1rem;
}

.daily-log-gallery__photo {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  border: 1px solid rgba(168, 190, 209, 0.16);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.025);
}

.daily-log-gallery__photo-button {
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 4 / 3;
  padding: 0.5rem;
  border: 0;
  border-bottom: 1px solid rgba(168, 190, 209, 0.12);
  background: rgba(3, 9, 14, 0.52);
  cursor: zoom-in;
}

.daily-log-gallery__photo-button img {
  display: block;
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
  font-size: 0.82rem;
  line-height: 1.4;
}

.daily-log-gallery__empty {
  margin: 0;
  padding: 3rem 1rem;
  border: 1px dashed rgba(168, 190, 209, 0.2);
  border-radius: 14px;
  text-align: center;
  color: var(--text-muted);
}

.daily-log-gallery__footer {
  padding: 0.2rem 0 1.5rem;
  color: var(--text-soft);
  font-size: 0.75rem;
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
  background: rgba(2, 7, 11, 0.96);
  outline: none;
}

.daily-log-gallery__lightbox-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: rgba(240, 246, 251, 0.78);
  font-size: 0.8rem;
}

.daily-log-gallery__lightbox button {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  color: #f0f6fb;
  background: rgba(17, 31, 42, 0.9);
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
  color: #f0f6fb;
  text-align: center;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.daily-log-gallery__lightbox-caption span {
  color: rgba(240, 246, 251, 0.75);
  font-size: 0.85rem;
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
