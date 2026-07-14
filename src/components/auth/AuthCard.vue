<script setup lang="ts">
defineProps<{
  copy?: string
  eyebrow: string
  title: string
}>()
</script>

<template>
  <div class="auth-page">
    <section class="auth-card" aria-labelledby="auth-card-title">
      <span class="auth-card__eyebrow">{{ eyebrow }}</span>
      <h1 id="auth-card-title" class="auth-card__title">{{ title }}</h1>
      <p v-if="copy" class="auth-card__copy">{{ copy }}</p>
      <slot />
    </section>
  </div>
</template>

<style scoped>
.auth-page {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 1.5rem;
}

.auth-card {
  width: min(100%, 460px);
  padding: 2rem;
  border: 1px solid var(--border);
  border-radius: 22px;
  background:
    radial-gradient(circle at top right, rgba(99, 199, 230, 0.12), transparent 34%),
    var(--surface-raised);
  box-shadow: var(--shadow);
}

.auth-card__eyebrow {
  color: var(--accent-strong);
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.auth-card__title {
  margin: 0.5rem 0 0;
  font-size: 1.75rem;
}

.auth-card__copy,
:global(.auth-card__copy) {
  margin: 0.65rem 0 1.5rem;
  color: var(--text-muted);
}

:global(.auth-field) {
  --app-text-input-min-height: 2.9rem;
  --app-text-input-padding-x: 0.95rem;
  --app-text-input-background: var(--field);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
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

@media (max-width: 560px) {
  .auth-card {
    padding: 1.4rem;
  }
}
</style>
