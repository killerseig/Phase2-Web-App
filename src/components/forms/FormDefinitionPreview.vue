<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import FormDefinitionFields from './FormDefinitionFields.vue'
import { validateFormAnswers, type FormAnswers } from '../../../functions/src/formModel'
import type { FormDefinition, FormField } from '@/features/forms/model'
const props = defineProps<{
    definition: FormDefinition
    canvasField?: FormField
    previousSection?: string
  }>(),
  answers = ref<FormAnswers>({}),
  errors = ref<string[]>([]),
  invalidField = ref('')
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
    answers.value = {}
    errors.value = []
  },
  { deep: true },
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
    <h2>{{ definition.title }}</h2>
    <p>{{ definition.description }}</p>
    <form novalidate @submit.prevent="validate">
      <FormDefinitionFields
        :definition="definition"
        v-model="answers"
        :invalid-field="invalidField"
      /><button type="submit">Check required fields</button>
      <ul v-if="errors.length" id="form-validation-message" role="alert">
        <li v-for="error in errors" :key="error">{{ error }}</li>
      </ul>
      <p role="status">Preview only. No submission or email is created.</p>
    </form>
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
  max-width: 48rem;
  margin: auto;
  padding: clamp(1rem, 3vw, 2.5rem);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 1rem;
}
.preview-field {
  display: grid;
  gap: 0.4rem;
  margin: 1rem 0;
}
label {
  font-weight: 600;
}
input,
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
