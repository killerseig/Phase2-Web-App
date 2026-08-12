<script setup lang="ts">
import AppCard from '@/components/common/AppCard.vue'
import AppField from '@/components/common/AppField.vue'
import AppSectionHeader from '@/components/common/AppSectionHeader.vue'
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
  <AppCard class="daily-log-text-card">
    <AppSectionHeader
      class="daily-log-text-card__header"
      :eyebrow="eyebrow"
      :title="section.title"
      title-tag="h2"
    />

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
  </AppCard>
</template>

<style scoped>
.daily-log-text-card {
  --app-section-header-copy-gap: 0.2rem;
  --app-section-header-eyebrow-font-size: 0.68rem;
  --app-section-header-eyebrow-letter-spacing: 0.12em;
  --app-section-header-title-color: var(--text);
  --app-section-header-title-font-size: 1.05rem;
  --app-section-header-title-font-weight: 700;
  --app-section-header-title-letter-spacing: normal;
  --app-section-header-title-text-transform: none;
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
