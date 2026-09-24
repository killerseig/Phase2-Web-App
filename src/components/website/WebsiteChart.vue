<script setup lang="ts">
import { computed, useId } from 'vue'
import type { WebsiteSection } from '@/features/website/types'
import { chartGeometry } from '@/features/website/charts'
const props = defineProps<{ section: WebsiteSection }>()
const id = useId()
const geometry = computed(() => chartGeometry(props.section.items.map((item) => item.value ?? 0)))
const kind = computed(() => props.section.blockOptions?.chartType || 'bar')
const colors = ['#174878', '#237a57', '#995114', '#824295', '#bd3645', '#246d82']
</script>
<template>
  <div class="chart">
    <svg
      v-if="kind === 'bar'"
      :viewBox="`0 0 640 ${Math.max(1, section.items.length) * 38 + 24}`"
      role="img"
      :aria-labelledby="id"
    >
      <title :id="id">{{ section.title }}. Values are available in the chart data table.</title>
      <line
        :x1="geometry.zero"
        :x2="geometry.zero"
        y1="4"
        :y2="section.items.length * 38"
        stroke="currentColor"
      />
      <g v-for="(point, index) in geometry.points" :key="section.items[index]!.id">
        <text x="4" :y="index * 38 + 22" fill="currentColor" font-size="14">
          {{ section.items[index]!.title.slice(0, 22) }}
        </text>
        <rect
          :x="Math.min(geometry.zero, point.barX)"
          :y="index * 38 + 4"
          :width="Math.abs(point.barX - geometry.zero)"
          height="26"
          fill="var(--website-accent, #174878)"
        >
          <title>{{ section.items[index]!.title }}: {{ point.value }}</title>
        </rect>
      </g>
    </svg>
    <svg
      v-else-if="kind === 'line' || kind === 'area'"
      viewBox="0 0 640 275"
      role="img"
      :aria-labelledby="id"
    >
      <title :id="id">{{ section.title }}. Values are available in the chart data table.</title>
      <path d="M 40 20 V 230 H 610" fill="none" stroke="currentColor" />
      <polygon
        v-if="kind === 'area' && geometry.points.length"
        :points="
          [
            `40,${geometry.zeroY}`,
            ...geometry.points.map((point) => `${point.x},${point.y}`),
            `${geometry.points.at(-1)!.x},${geometry.zeroY}`,
          ].join(' ')
        "
        fill="var(--website-accent,#174878)"
        opacity=".18"
      />
      <polyline
        :points="geometry.points.map((point) => `${point.x},${point.y}`).join(' ')"
        fill="none"
        stroke="var(--website-accent, #174878)"
        stroke-width="3"
      />
      <g v-for="(point, index) in geometry.points" :key="section.items[index]!.id">
        <circle :cx="point.x" :cy="point.y" r="5" fill="var(--website-accent, #174878)">
          <title>{{ section.items[index]!.title }}: {{ point.value }}</title>
        </circle>
        <text :x="point.x" y="253" text-anchor="middle" font-size="12" fill="currentColor">
          {{ index + 1 }}
        </text>
      </g>
    </svg>
    <svg v-else viewBox="0 0 240 240" class="donut" role="img" :aria-labelledby="id">
      <title :id="id">{{ section.title }}. Values are available in the chart data table.</title>
      <circle cx="120" cy="120" r="85" fill="none" stroke="#dbe1e7" stroke-width="35" />
      <circle
        v-for="(point, index) in geometry.points"
        :key="section.items[index]!.id"
        cx="120"
        cy="120"
        r="85"
        pathLength="100"
        fill="none"
        :stroke="colors[index % colors.length]"
        stroke-width="35"
        :stroke-dasharray="`${point.share} ${100 - point.share}`"
        :stroke-dashoffset="-point.offset"
        transform="rotate(-90 120 120)"
      >
        <title>{{ section.items[index]!.title }}: {{ point.value }}</title>
      </circle>
    </svg>
    <component
      :is="section.blockOptions?.showData === false ? 'details' : 'div'"
      @pointerdown.stop
      @keydown.stop
    >
      <summary v-if="section.blockOptions?.showData === false">View chart data</summary>
      <table>
        <caption>
          Chart data
        </caption>
        <thead>
          <tr>
            <th scope="col">Label</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in section.items" :key="item.id">
            <th scope="row">
              <span
                v-if="kind === 'donut'"
                class="swatch"
                :style="{ backgroundColor: colors[index % colors.length] }"
                aria-hidden="true"
              />{{ ['line', 'area'].includes(kind) ? `${index + 1}. ` : '' }}{{ item.title }}
            </th>
            <td>{{ item.value ?? 0 }}</td>
          </tr>
        </tbody>
      </table>
    </component>
  </div>
</template>
<style scoped>
svg {
  display: block;
  width: 100%;
  height: auto;
  max-height: 360px;
}
.donut {
  max-height: 260px;
}
table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.9em;
}
th,
td {
  padding: 0.4em;
  border-bottom: 1px solid #bbc6d0;
  overflow-wrap: anywhere;
}
td {
  text-align: right;
}
caption {
  text-align: left;
  padding: 0.5em 0;
  font-weight: bold;
}
.swatch {
  display: inline-block;
  width: 0.8em;
  height: 0.8em;
  margin-right: 0.5em;
}
</style>
