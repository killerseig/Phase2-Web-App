<script setup lang="ts">
import RecipientEditor from '@/components/RecipientEditor.vue'

defineProps<{
  adminRecipients: readonly string[]
  additionalRecipients: readonly string[]
  canEdit: boolean
  modelValue: string
  saving: boolean
}>()

const emit = defineEmits<{
  add: []
  remove: [email: string]
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <article class="daily-log-recipients-card daily-logs-card">
    <header class="daily-log-recipients-card__header">
      <div>
        <span class="daily-log-recipients-card__eyebrow">Recipients</span>
        <h2 class="daily-log-recipients-card__title">Email List</h2>
      </div>
    </header>

    <div class="daily-log-recipients-card__groups">
      <RecipientEditor
        title="Admin Defaults"
        hint="Read only"
        :recipients="adminRecipients"
        read-only
        row-badge="Default"
        empty-label="No default recipients yet."
      />

      <RecipientEditor
        :model-value="modelValue"
        title="Additional Recipients"
        hint="Added for this log only"
        :disabled="!canEdit || saving"
        :recipients="additionalRecipients"
        empty-label="No extra recipients yet."
        @update:model-value="emit('update:modelValue', $event)"
        @add="emit('add')"
        @remove="emit('remove', $event)"
      />
    </div>
  </article>
</template>

<style scoped>
.daily-log-recipients-card {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0)),
    rgba(29, 38, 49, 0.92);
  box-shadow: var(--shadow);
}

.daily-log-recipients-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem;
}

.daily-log-recipients-card__eyebrow {
  color: var(--accent-strong);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.daily-log-recipients-card__title {
  margin: 0.2rem 0 0;
  font-size: 1.05rem;
}

.daily-log-recipients-card__groups {
  display: grid;
  gap: 0.9rem;
}

@media (max-width: 920px) {
  .daily-log-recipients-card__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
