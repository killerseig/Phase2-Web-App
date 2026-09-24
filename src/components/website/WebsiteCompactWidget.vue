<script setup lang="ts">
import { computed, useId } from 'vue'
import type { WebsiteSection } from '@/features/website/types'
import { chartGeometry } from '@/features/website/charts'
import WebsiteInlineText from './WebsiteInlineText.vue'
import WebsiteButton from './WebsiteButton.vue'
import WebsiteMedia from './WebsiteMedia.vue'
const props = defineProps<{ section: WebsiteSection; preview?: boolean }>()
const id = useId()
const trend = computed(() => chartGeometry(props.section.items.map((item) => item.value ?? 0)))
const percentage = computed(() => Math.min(100, Math.max(0, props.section.value || 0)))
</script>
<template>
  <article class="compact-widget" :class="`compact-${section.type}`">
    <div
      v-if="section.imageId && ['card', 'profile-card'].includes(section.type)"
      class="component-image widget-image"
    >
      <WebsiteMedia :item="section" :preview="preview" />
    </div>
    <WebsiteInlineText
      :id="section.id"
      field="title"
      :text="section.title"
      :rich="section.titleRichText"
      :preview="preview"
    />
    <strong v-if="section.type === 'metric'" class="metric-value">{{
      section.value ?? (preview ? 'Add value' : '')
    }}</strong>
    <div
      v-if="section.type === 'progress-ring'"
      class="ring"
      role="progressbar"
      :aria-label="section.title"
      :aria-valuenow="percentage"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="48" fill="none" stroke="#dbe1e7" stroke-width="10" />
        <circle
          cx="60"
          cy="60"
          r="48"
          fill="none"
          stroke="var(--website-accent,#174878)"
          stroke-width="10"
          pathLength="100"
          :stroke-dasharray="`${percentage} ${100 - percentage}`"
          transform="rotate(-90 60 60)"
        />
      </svg>
      <strong>{{ percentage }}%</strong>
    </div>
    <p v-if="section.subtitle" class="subtitle">{{ section.subtitle }}</p>
    <WebsiteInlineText
      v-if="section.text || section.textRichText || preview"
      :id="section.id"
      field="text"
      :rich="section.textRichText"
      :text="section.text"
      :format="section.textFormat"
      :preview="preview"
    />
    <template v-if="section.type === 'sparkline'">
      <svg
        class="sparkline"
        viewBox="0 0 640 260"
        role="img"
        :aria-labelledby="id"
        preserveAspectRatio="none"
      >
        <title :id="id">
          {{ section.title }} trend. Exact values are available under View data.
        </title>
        <polyline
          :points="trend.points.map((point) => `${point.x},${point.y}`).join(' ')"
          fill="none"
          stroke="var(--website-accent,#174878)"
          stroke-width="3"
          vector-effect="non-scaling-stroke"
        />
        <circle
          v-for="(point, index) in trend.points"
          :key="section.items[index]!.id"
          :cx="point.x"
          :cy="point.y"
          r="4"
          fill="var(--website-accent,#174878)"
        >
          <title>{{ section.items[index]!.title }}: {{ point.value }}</title>
        </circle>
      </svg>
      <details @pointerdown.stop @keydown.stop>
        <summary>View data</summary>
        <table>
          <caption>
            {{
              section.title
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">Label</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in section.items" :key="item.id">
              <th scope="row">{{ item.title }}</th>
              <td>{{ item.value }}</td>
            </tr>
          </tbody>
        </table>
      </details>
    </template>
    <div
      v-if="section.type === 'data-table'"
      class="table-scroll"
      tabindex="0"
      role="region"
      :aria-label="section.title"
      @pointerdown.stop
      @keydown.stop
    >
      <table>
        <caption>
          {{
            section.title
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">Label</th>
            <th scope="col">Details</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in section.items" :key="item.id">
            <th scope="row">{{ item.title }}</th>
            <td>{{ item.text }}</td>
            <td>{{ item.value ?? '' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <WebsiteButton
      hide-empty
      class="widget-button card-link"
      :item="section"
      :section-id="section.id"
      :preview="preview"
    />
  </article>
</template>
<style scoped>
.compact-widget {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 0;
  width: 100%;
  overflow-wrap: anywhere;
}
h2 {
  font-size: var(--heading-size, 1.1rem);
  line-height: 1.25;
  margin: 0;
}
.component-image {
  max-height: 200px;
  overflow: hidden;
  border-radius: 6px;
}
.component-image :deep(img) {
  max-height: 200px;
}
.compact-profile-card .component-image {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  align-self: center;
  flex-shrink: 0;
}
.compact-profile-card .component-image :deep(img) {
  height: 76px;
  width: 76px;
  object-fit: cover;
}
.compact-profile-card {
  text-align: center;
}
.metric-value {
  font-size: 2.4em;
  line-height: 1.1;
}
.subtitle {
  margin: 0;
  opacity: 0.8;
  font-size: 0.9em;
}
.ring {
  position: relative;
  width: 120px;
  max-width: 100%;
  align-self: center;
}
.ring svg {
  display: block;
  width: 100%;
}
.ring strong {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 1.3em;
}
.sparkline {
  width: 100%;
  height: 72px;
  flex-shrink: 0;
}
summary {
  font-size: 0.85em;
  cursor: pointer;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85em;
  text-align: left;
  table-layout: fixed;
}
th,
td {
  padding: 0.5em;
  border-bottom: 1px solid #dbe1e7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
caption {
  text-align: left;
  font-weight: 600;
  padding: 0.5em;
}
.table-scroll {
  overflow: auto;
  min-width: 0;
}
.card-link {
  align-self: flex-start;
  color: inherit;
  margin-top: auto;
}
.compact-profile-card .card-link {
  align-self: center;
}
:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
</style>
