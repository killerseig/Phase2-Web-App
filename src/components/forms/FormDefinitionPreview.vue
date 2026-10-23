<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import FormDefinitionFields from './FormDefinitionFields.vue'
import FormPresentation from './FormPresentation.vue'
import AppCard from '@/components/common/AppCard.vue'
import AppSectionHeader from '@/components/common/AppSectionHeader.vue'
import AppButton from '@/components/common/AppButton.vue'
import { hydrateDraftAnswers } from '@/features/forms/formDirtyState'
import { validateFormAnswers, type FormAnswers } from '../../../functions/src/formModel'
import type { FormDefinition, FormField } from '@/features/forms/model'
const props = defineProps<{
    definition: FormDefinition
    canvasField?: FormField
    previousSection?: string
  }>(),
  answers = ref<FormAnswers>({}),
  errors = ref<string[]>([]),
  invalidField = ref(''), photoNotice = ref('')
const canvasDefinition = computed(() =>
  props.canvasField
    ? {
        ...props.definition,
        fields: [
          {
            ...props.canvasField,
            section:
              props.previousSection === props.canvasField.section
                ? undefined
                : props.canvasField.section,
          },
        ],
      }
    : props.definition,
)
watch(
  () => (props.canvasField ? undefined : props.definition),
  () => {
    answers.value = hydrateDraftAnswers(props.definition.fields, {})
    errors.value = []
    photoNotice.value = ''
  },
  { deep: true, immediate: true },
)
async function validate() {
  invalidField.value = ''
  try {
    validateFormAnswers(props.definition, answers.value, true)
    errors.value = []
  } catch (error) {
    errors.value = [(error as Error).message]
    invalidField.value =
      props.definition.fields.find(
        (field) =>
          errors.value[0]?.startsWith(field.label + ':') ||
          errors.value[0]?.startsWith(field.label + ' '),
      )?.id || ''
    await nextTick()
    document.getElementById('answer-' + invalidField.value)?.focus()
  }
}
</script>
<template>
  <div v-if="canvasField" class="canvas-control-preview">
    <FormDefinitionFields
      :definition="canvasDefinition"
      :model-value="{}"
      disabled
      :photos-enabled="canvasField.kind === 'photo'"
    />
  </div>
  <section v-else class="form-preview" aria-label="Full-page form preview">
    <FormPresentation :title="definition.title" main-label="Form preview fields">
      <template #header-actions><small>Preview · not saved</small></template>
      <template #messages><p v-if="errors.length" id="form-validation-message" role="alert">{{ errors.join(' ') }}</p></template>
      <p v-if="definition.description" class="form-description">{{ definition.description }}</p>
      <FormDefinitionFields
        :definition="definition"
        v-model="answers"
        :invalid-field="invalidField"
        photos-enabled
        @upload="(_fieldId, files) => { photoNotice = files.length + ' photo(s) selected for preview only. Nothing was uploaded.' }"
      />
      <div class="response-actions"><AppButton disabled>Save progress</AppButton><AppButton variant="primary" @click="validate">Check required fields</AppButton></div>
      <template #sidebar><AppCard class="response-information"><AppSectionHeader title="Response details" title-tag="h2" /><p>Preview of the current form, including unsaved edits.</p><p role="status">Preview only. No submission or email is created.</p><p v-if="photoNotice" role="status">{{ photoNotice }}</p><p>Record history appears here when filling a saved form.</p></AppCard></template>
    </FormPresentation>
  </section>
</template>
<style scoped>
.canvas-control-preview :deep(.form-fields) {
  margin: 0;
}
.canvas-control-preview :deep(.form-field) {
  margin: 0.35rem 0;
}
.canvas-control-preview :deep(input:disabled),
.canvas-control-preview :deep(textarea:disabled),
.canvas-control-preview :deep(select:disabled) {
  opacity: 1;
  color: var(--text);
}

.form-preview {
  width: 100%;
  min-width: 0;
}
.preview-field {
  display: grid;
  gap: 0.4rem;
  margin: 1rem 0;
}
label {
  font-weight: 600;
}
input:not([type='checkbox']):not([type='radio']),
textarea,
select {
  width: 100%;
  padding: 0.65rem;
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  background: var(--surface);
  color: var(--text);
}
textarea {
  min-height: 7rem;
}
button {
  padding: 0.65rem 1rem;
}
p {
  color: var(--muted);
}
</style>
