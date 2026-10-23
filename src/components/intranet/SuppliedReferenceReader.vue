<script setup lang="ts">
import { ref, watch } from 'vue'
import type { IntranetForm, IntranetResource, ReadingPair } from '@/features/intranet/content'
const props = defineProps<{ title: string; resource?: IntranetResource; form?: IntranetForm; paragraphs?: ReadingPair[] }>()
const language = ref<'en' | 'es' | 'bi'>('en')
watch(() => props.title, () => { language.value = 'en' })
</script>
<template>
  <article class="supplied-reference">
    <h3>{{ title }}</h3>
    <p v-if="resource">{{ resource.kind }} — {{ resource.category }}. The source file was omitted from the ZIP. Uploaded documents remain in the current library.</p>
    <p v-if="resource?.filename">Source filename: {{ resource.filename }}</p>
    <template v-if="form">
      <p>Read-only supplied form reference. Completion, signatures and delivery are unavailable in this reference view. Published reports above use the current approved forms.</p>
      <p v-for="(paragraph, index) in form.paragraphs" :key="index">{{ paragraph }}</p>
      <h4>Supplied fields</h4><ol><li v-for="(field, index) in form.fields" :key="index">{{ field.label }}{{ field.signature ? ' — signature field' : '' }}</li></ol>
    </template>
    <template v-if="paragraphs">
      <p>Supplied reading text. Original PDFs, orientation reading pages and video were omitted. Acknowledgment, signatures and submission are unavailable here.</p>
      <label>Reading language <select v-model="language"><option value="en">English</option><option value="es">Español</option><option value="bi">Bilingual</option></select></label>
      <p v-if="language !== 'en' && paragraphs.some(item => !item.es)">English is retained where the ZIP supplied no Spanish translation.</p>
      <ol><li v-for="(item, index) in paragraphs" :key="index"><p v-if="language !== 'es' || !item.es" lang="en">{{ item.en }}</p><p v-if="language !== 'en' && item.es" lang="es">{{ item.es }}</p></li></ol>
    </template>
  </article>
</template>
<style scoped>.supplied-reference { overflow-wrap: anywhere; line-height: 1.5; } h3 { margin-top: 0; } select { font: inherit; max-width: 100%; }</style>
