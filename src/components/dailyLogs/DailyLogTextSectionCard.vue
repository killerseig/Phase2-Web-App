<script setup lang="ts">
import AppField from '@/components/common/AppField.vue'
import AppTextarea from '@/components/common/AppTextarea.vue'
import type {
  DailyLogTextFieldKey,
  DailyLogTextSectionSchema,
} from '@/features/dailyLogs/schema'

const props = defineProps<{
  disabled: boolean
  eyebrow: string
  section: DailyLogTextSectionSchema
  values: Partial<Record<DailyLogTextFieldKey, string>>
}>()

const emit = defineEmits<{
  'blur-field': [fieldKey: DailyLogTextFieldKey]
  'update-field': [fieldKey: DailyLogTextFieldKey, value: string]
}>()

function getFieldValue(fieldKey: DailyLogTextFieldKey) {
  return props.values[fieldKey] ?? ''
}

function handleUpdate(fieldKey: DailyLogTextFieldKey, value: string) {
  emit('update-field', fieldKey, value)
}
</script>

<template>
  <article class="daily-log-text-card">
    <header class="daily-log-text-card__header">
      <div>
        <span class="daily-log-text-card__eyebrow">{{ eyebrow }}</span>
        <h2 class="daily-log-text-card__title">{{ section.title }}</h2>
      </div>
    </header>

    <div class="daily-log-text-card__stack">
      <AppField
        v-for="field in section.fields"
        :key="field.key"
        class="daily-log-text-card__field"
        :label="field.label"
      >
        <AppTextarea
          :model-value="getFieldValue(field.key)"
          :data-testid="`dailylog-${field.key}`"
          :rows="field.rows"
          :disabled="disabled"
          :placeholder="field.placeholder || ''"
          @update:model-value="handleUpdate(field.key, $event)"
          @blur="emit('blur-field', field.key)"
        />
      </AppField>
    </div>
  </article>
</template>

<style scoped>
.daily-log-text-card {
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

.daily-log-text-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem;
}

.daily-log-text-card__eyebrow {
  color: var(--accent-strong);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.daily-log-text-card__title {
  margin: 0.2rem 0 0;
  font-size: 1.05rem;
}

.daily-log-text-card__stack {
  display: grid;
  gap: 0.85rem;
}

.daily-log-text-card__field {
  --app-field-color: var(--text-muted);
  --app-textarea-background: rgba(255, 255, 255, 0.045);
}

@media (max-width: 920px) {
  .daily-log-text-card__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
