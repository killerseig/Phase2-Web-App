<script setup lang="ts">
import { computed } from 'vue'
import { compilePageCss, pageCssTemplate } from '../../../functions/src/websiteDesign'
const props = defineProps<{ modelValue?: string; expanded?: boolean; label?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const error = computed(() => {
  try {
    compilePageCss(props.modelValue || '', 'editor-check')
    return ''
  } catch (error) {
    return error instanceof Error ? error.message : 'Check the CSS syntax.'
  }
})
</script>
<template>
  <details class="css-editor" :open="expanded">
    <summary>{{ label || 'Page CSS' }}</summary>
    <p>
      Edit the template directly. Valid CSS previews immediately and is published with the page.
    </p>
    <div class="css-actions">
      <button type="button" @click="emit('update:modelValue', pageCssTemplate)">
        {{ modelValue ? 'Replace with starter template' : 'Insert starter template' }}
      </button>
      <button type="button" :disabled="!modelValue" @click="emit('update:modelValue', '')">
        Clear CSS
      </button>
    </div>
    <label
      >{{ label || 'Page CSS'
      }}<textarea
        :aria-label="label || 'Page CSS'"
        :value="modelValue || ''"
        rows="18"
        spellcheck="false"
        maxlength="12000"
        placeholder="Insert the starter template to begin."
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      />
    </label>
    <p v-if="error" role="alert">
      {{ error }} The preview keeps the last valid CSS. Fix this before saving.
    </p>
    <small v-else>Page CSS takes priority over matching appearance settings.</small>
    <details>
      <summary>Selectors and syntax</summary>
      <p>
        Use .page, .page-header, .page-footer, .page-brand, .page-navigation, .page-content,
        .widget, .widget-title, .widget-text, .widget-image img, .widget-button, and
        .container-items.
      </p>
      <p>
        Give a widget a class such as custom-feature and target .custom-feature or .custom-feature
        .widget-title. :hover and :focus-visible are supported. @media min/max-width rules follow
        the preview width.
      </p>
      <p>
        Use plain CSS declarations for colors, typography, spacing, borders, shadows, image fit and
        flex/grid content layout. Sass, nested rules, positioning, transforms and external
        imports/URLs are not supported. Use canvas controls for placement and rotation.
      </p>
    </details>
  </details>
</template>
<style scoped>
.css-editor {
  border-block: 1px solid var(--border);
  padding: 0.6rem 0;
}
summary {
  cursor: pointer;
  font-weight: 600;
}
textarea {
  width: 100%;
  box-sizing: border-box;
  font:
    0.8rem/1.5 Consolas,
    monospace;
  white-space: pre;
  overflow: auto;
  resize: vertical;
  background: var(--field);
  color: var(--text);
  border: 1px solid var(--border);
}
p,
small {
  font-size: 0.8rem;
  overflow-wrap: anywhere;
}
.css-actions {
  display: flex;
  gap: 0.4rem;
  margin: 0.5rem 0;
}
button {
  padding: 0.4rem;
  font-size: 0.75rem;
}
[role='alert'] {
  color: var(--danger, #d66);
}
</style>
