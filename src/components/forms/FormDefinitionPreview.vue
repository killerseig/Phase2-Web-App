<script setup lang="ts">
import { ref, watch } from 'vue'
import FormDefinitionFields from './FormDefinitionFields.vue'
import { validateFormAnswers, type FormAnswers } from '../../../functions/src/formModel'
import type { FormDefinition } from '@/features/forms/model'
const props = defineProps<{ definition: FormDefinition }>(),
  answers = ref<FormAnswers>({}),
  errors = ref<string[]>([])
watch(
  () => props.definition,
  () => {
    answers.value = {}
    errors.value = []
  },
  { deep: true },
)
function validate() {
  try {
    validateFormAnswers(props.definition, answers.value, true)
    errors.value = []
  } catch (error) {
    errors.value = [(error as Error).message]
  }
}
</script>
<template>
  <section class="form-preview" aria-label="Full-page form preview">
    <h2>{{ definition.title }}</h2>
    <p>{{ definition.description }}</p>
    <form @submit.prevent="validate">
      <FormDefinitionFields :definition="definition" v-model="answers" /><button type="submit">
        Check required fields
      </button>
      <ul v-if="errors.length" role="alert">
        <li v-for="error in errors" :key="error">{{ error }}</li>
      </ul>
      <p role="status">Preview only. No submission or email is created.</p>
    </form>
  </section>
</template>
<style scoped>
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
