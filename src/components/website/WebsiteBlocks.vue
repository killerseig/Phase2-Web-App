<script setup lang="ts">
import type { WebsiteSection } from '@/features/website/types'
import WebsiteInlineText from './WebsiteInlineText.vue'
import WebsiteButton from './WebsiteButton.vue'
import WebsiteMedia from './WebsiteMedia.vue'
import WebsiteChart from './WebsiteChart.vue'
defineProps<{ section: WebsiteSection; preview?: boolean }>()
</script>
<template>
  <div
    class="blocks"
    :class="[`block-${section.type}`, section.blockOptions?.variant || 'solid']"
    :style="{ '--block-columns': section.blockOptions?.columns || 3 }"
  >
    <hr v-if="section.type === 'divider'" />
    <div v-else-if="section.type === 'spacer'" class="spacer" :aria-hidden="!preview">
      <span v-if="preview">Spacer</span>
    </div>
    <WebsiteButton
      v-else-if="section.type === 'button' && (section.linkUrl || preview)"
      class="block-button widget-button"
      :item="section"
      :section-id="section.id"
      :preview="preview"
      :fallback="section.title"
    />
    <span v-else-if="section.type === 'badge'" class="badge">{{ section.title }}</span>
    <template v-else>
      <i
        v-if="['icon', 'alert'].includes(section.type)"
        :class="['pi', `pi-${section.icon || 'info-circle'}`]"
        aria-hidden="true"
      />
      <WebsiteInlineText
        v-if="section.title || preview"
        :id="section.id"
        field="title"
        :text="section.title"
        :rich="section.titleRichText"
        :preview="preview"
      />
      <WebsiteInlineText
        v-if="section.text || section.textRichText || preview"
        :id="section.id"
        field="text"
        :rich="section.textRichText"
        :text="section.text"
        :format="section.textFormat"
        :preview="preview"
      />
      <WebsiteChart v-if="section.type === 'chart'" :section="section" />
      <component
        :is="
          section.type === 'list' && section.blockOptions?.listStyle === 'numbered' ? 'ol' : 'ul'
        "
        v-else-if="['list', 'timeline'].includes(section.type)"
        :class="[section.type, { checks: section.blockOptions?.listStyle === 'check' }]"
      >
        <li v-for="item in section.items" :key="item.id">
          <span v-if="section.type === 'timeline' && item.subtitle" class="subtitle">{{
            item.subtitle
          }}</span>
          <WebsiteInlineText
            :id="section.id"
            :target-key="item.id"
            field="title"
            tag="h3"
            :text="item.title"
            :rich="item.titleRichText"
            :preview="preview"
          />
          <WebsiteInlineText
            :id="section.id"
            :target-key="item.id"
            field="text"
            :text="item.text"
            :rich="item.textRichText"
            :format="item.textFormat"
            :preview="preview"
          />
          <WebsiteButton hide-empty :item="item" :section-id="section.id" :preview="preview" />
        </li>
      </component>
      <div v-else-if="section.type === 'progress'" class="progress-list">
        <label v-for="item in section.items" :key="item.id"
          >{{ item.title }}: {{ item.value ?? 0 }}%
          <progress :value="item.value || 0" max="100">{{ item.value || 0 }}%</progress>
        </label>
      </div>
      <div
        v-else-if="['team', 'testimonials', 'statistics', 'logos'].includes(section.type)"
        class="block-grid"
      >
        <article v-for="item in section.items" :key="item.id">
          <div v-if="item.imageId" class="block-image widget-image">
            <WebsiteMedia :item="item" :preview="preview" />
          </div>
          <template v-if="section.type === 'testimonials'">
            <blockquote>
              <WebsiteInlineText
                :id="section.id"
                :target-key="item.id"
                field="text"
                :text="item.text"
                :rich="item.textRichText"
                :format="item.textFormat"
                :preview="preview"
              />
            </blockquote>
            <div class="attribution">
              <WebsiteInlineText
                :id="section.id"
                :target-key="item.id"
                field="title"
                tag="div"
                :text="item.title"
                :rich="item.titleRichText"
                :preview="preview"
              />
              <span v-if="item.subtitle">{{ item.subtitle }}</span>
            </div>
          </template>
          <template v-else>
            <strong v-if="section.type === 'statistics'" class="stat-value">{{
              item.value ?? 0
            }}</strong>
            <WebsiteInlineText
              :id="section.id"
              :target-key="item.id"
              field="title"
              tag="h3"
              :text="item.title"
              :rich="item.titleRichText"
              :preview="preview"
            />
            <p v-if="item.subtitle" class="subtitle">{{ item.subtitle }}</p>
            <WebsiteInlineText
              v-if="item.text || item.textRichText || preview"
              :id="section.id"
              :target-key="item.id"
              field="text"
              :rich="item.textRichText"
              :text="item.text"
              :format="item.textFormat"
              :preview="preview"
            />
          </template>
          <WebsiteButton hide-empty :item="item" :section-id="section.id" :preview="preview" />
        </article>
      </div>
      <WebsiteButton
        hide-empty
        class="widget-button"
        :item="section"
        :section-id="section.id"
        :preview="preview"
      />
    </template>
  </div>
</template>
<style scoped>
.blocks {
  width: 100%;
  min-width: 0;
  overflow-wrap: anywhere;
  container-type: inline-size;
}
h2,
h3 {
  margin: 0 0 0.65rem;
}
h2 {
  font-size: var(--heading-size, 1.6em);
}
h3 {
  font-size: 1.15em;
}
a {
  color: inherit;
}
.blocks > .block-button,
.badge {
  display: inline-block;
  padding: 0.65em 1.2em;
  border: 1px solid currentColor;
  border-radius: 0.35em;
}
.blocks.solid > .block-button,
.solid .badge {
  background: var(--website-accent, #174878);
  color: white;
}
.blocks.outline > .block-button,
.outline .badge {
  background: transparent;
  color: inherit;
}
.badge {
  font-size: 0.85em;
  border-radius: 2em;
}
hr {
  border: 0;
  border-top: 2px solid currentColor;
  width: 100%;
}
.spacer {
  min-height: 24px;
  text-align: center;
  opacity: 0.6;
}
.block-icon .pi {
  font-size: 3em;
  margin-bottom: 0.5em;
}
.block-alert {
  border: 1px solid currentColor;
  border-left: 5px solid currentColor;
  padding: 1em;
  box-sizing: border-box;
}
.block-alert.solid {
  background: #eaf0f5;
  color: #19364c;
}
.block-alert .pi {
  float: left;
  margin: 0.2em 0.8em 0.4em 0;
}
.block-grid {
  display: grid;
  grid-template-columns: repeat(var(--block-columns), minmax(0, 1fr));
  gap: 1.2rem;
}
.block-grid article {
  min-width: 0;
}
.block-image {
  margin-bottom: 0.8em;
}
.block-image :deep(img) {
  max-height: 260px;
}
.block-logos .block-image :deep(img) {
  object-fit: contain;
  max-height: 120px;
}
blockquote {
  margin: 0 0 0.75em;
  padding-left: 1em;
  border-left: 3px solid currentColor;
}
.subtitle {
  font-size: 0.9em;
  opacity: 0.8;
}
.attribution {
  font-weight: 600;
}
.stat-value {
  display: block;
  font-size: 2.6em;
  line-height: 1.2;
  margin-bottom: 0.2em;
}
.timeline {
  list-style: none;
  padding-left: 1em;
  border-left: 2px solid currentColor;
}
.timeline li {
  padding: 0 0 1em 1em;
}
.list {
  padding-left: 1.5em;
}
.list li {
  padding: 0.4em 0;
}
.checks {
  list-style: '\2713  ';
}
.progress-list,
label {
  display: grid;
  gap: 0.7em;
}
label {
  gap: 0.25em;
}
progress {
  width: 100%;
  height: 1.2em;
  accent-color: var(--website-accent, #174878);
}
@container (max-width:1023px) {
  .block-grid {
    grid-template-columns: repeat(min(2, var(--block-columns)), minmax(0, 1fr));
  }
}
@container (max-width:767px) {
  .block-grid {
    grid-template-columns: 1fr;
  }
}
</style>
