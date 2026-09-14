<script setup lang="ts">
import '@/styles/brand-workspace.css'
defineProps<{
  copy?: string
  eyebrow: string
  title: string
}>()
</script>

<template>
  <div
    class="auth-page public-page"
    :class="{
      'auth-page--with-media': $slots.media,
      'auth-page--with-backdrop': $slots.backdrop,
    }"
  >
    <div v-if="$slots.media" class="auth-page__media" aria-hidden="true">
      <slot name="media" />
    </div>
    <div class="auth-page__content">
      <div v-if="$slots.backdrop" class="auth-page__backdrop" aria-hidden="true">
        <slot name="backdrop" />
      </div>
      <section class="auth-card" aria-labelledby="auth-card-title">
        <span class="auth-card__eyebrow">{{ eyebrow }}</span>
        <h1 id="auth-card-title" class="auth-card__title">{{ title }}</h1>
        <p v-if="copy" class="auth-card__copy">{{ copy }}</p>
        <slot />
      </section>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 1.5rem;
  background: var(--bg);
}

.auth-page__content {
  position: relative;
  isolation: isolate;
  display: grid;
  place-items: center;
  width: 100%;
  min-width: 0;
}

.auth-page__backdrop {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  background: #08111f;
  pointer-events: none;
}

.auth-page__backdrop :slotted(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.auth-card {
  width: min(100%, 460px);
  padding: 2rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  box-shadow: none;
}

.auth-card__eyebrow {
  color: var(--brand-clay);
  font-size: var(--font-size-eyebrow);
  letter-spacing: var(--letter-spacing-eyebrow);
  text-transform: uppercase;
}

.auth-card__title {
  margin: 0.5rem 0 0;
  font-size: 1.75rem;
}

.auth-page--with-media {
  grid-template-columns: minmax(0, 1.1fr) minmax(26rem, 0.9fr);
  align-items: stretch;
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  padding: 0;
  overflow-y: auto;
  font-family: var(--font-body);
}

.auth-page__media {
  position: relative;
  align-self: stretch;
  width: 100%;
  min-width: 0;
  min-height: 32rem;
  overflow: hidden;
  background: var(--bg-elevated);
}

.auth-page__media :slotted(img) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.auth-page__media::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.2);
  pointer-events: none;
}

.auth-page--with-media .auth-card {
  align-self: center;
  width: min(100%, 30rem);
  padding: var(--space-10);
  border: 0;
  border-radius: 0;
}

.auth-page--with-backdrop .auth-card {
  background: transparent;
}

.auth-page--with-media .auth-card__eyebrow {
  font-weight: var(--font-weight-heading);
  letter-spacing: 0.1em;
}

.auth-page--with-media .auth-card__title {
  margin-bottom: var(--space-8);
  padding-bottom: var(--space-6);
  border-bottom: 1px solid var(--border);
  font-size: 2rem;
  font-weight: var(--font-weight-heading);
  line-height: 1.2;
  letter-spacing: -0.035em;
}

.auth-card__copy,
:global(.auth-card__copy) {
  margin: 0.65rem 0 1.5rem;
  color: var(--text-muted);
}

:global(.auth-field) {
  --app-text-input-min-height: var(--control-height-form);
  --app-text-input-padding-x: var(--control-padding-x);
  --app-text-input-background: var(--control-background);
  display: flex;
  flex-direction: column;
  gap: var(--field-gap);
  margin-bottom: 1rem;
  color: var(--text-muted);
}

:global(.auth-card__button) {
  width: 100%;
  margin-top: 0.5rem;
}

:global(.auth-card__link) {
  display: flex;
  justify-content: center;
  width: 100%;
  margin-top: 0.95rem;
  color: var(--accent);
  text-align: center;
}

:global(.auth-card__status) {
  margin-top: 1.25rem;
  font-size: 0.92rem;
}

@media (max-width: 900px) {
  .auth-page--with-media {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: clamp(8rem, 24svh, 14rem) minmax(min-content, 1fr);
    align-content: stretch;
  }

  .auth-page__media {
    min-height: 0;
  }

  .auth-page__backdrop::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(4, 11, 22, 0.4);
  }

  .auth-page--with-media .auth-card {
    align-self: start;
    padding: var(--space-8) var(--space-6);
  }

  .auth-page--with-media .auth-card__title {
    font-size: 1.75rem;
  }
}

@media (max-width: 560px) {
  .auth-card {
    padding: 1.4rem;
    background: var(--surface);
  }
}
</style>
