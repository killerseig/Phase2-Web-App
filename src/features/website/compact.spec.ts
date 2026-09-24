import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { newSection, newItem } from './types'
import { nextGeometry } from './grid'
import { blockErrors, validateBlockOptions } from '../../../functions/src/websiteBlocks'
import { chartGeometry } from './charts'
import WebsiteCompactWidget from '@/components/website/WebsiteCompactWidget.vue'
import WebsiteChart from '@/components/website/WebsiteChart.vue'

describe('compact website components', () => {
  it('starts compact widgets with small editable geometry and keeps saved geometry intact', () => {
    expect(nextGeometry([], 'metric')).toMatchObject({ w: 6, h: 5 })
    expect(nextGeometry([], 'card')).toMatchObject({ w: 8, h: 11 })
    expect(newSection('metric').appearance).toMatchObject({ padding: 12, headingSize: 18 })
    expect(nextGeometry([], 'metric', { w: 12, h: 15 })).toMatchObject({ w: 12, h: 15 })
    expect(newSection('hero').appearance).toBeUndefined()
  })
  it('validates standalone numeric values and preserves zero and negative metrics', () => {
    const metric = newSection('metric')
    expect(blockErrors(metric)).toContain('Enter a numeric value for this component.')
    metric.value = 0
    expect(blockErrors(metric)).toEqual([])
    metric.value = -25
    expect(blockErrors(metric)).toEqual([])
    metric.type = 'progress-ring'
    expect(blockErrors(metric)).toContain('Progress must be between 0 and 100.')
    metric.value = 100
    expect(blockErrors(metric)).toEqual([])
    expect(validateBlockOptions({ chartType: 'area', showData: false })).toEqual({
      chartType: 'area',
      showData: false,
    })
    expect(() => validateBlockOptions({ showData: 'yes' })).toThrow()
  })
  it('renders a metric directly, native progress semantics and exact trend data without a collection heading', () => {
    const metric = newSection('metric')
    metric.value = 0
    metric.title = 'Open items'
    const tile = mount(WebsiteCompactWidget, { props: { section: metric } })
    expect(tile.find('.metric-value').text()).toBe('0')
    expect(tile.findAll('h2')).toHaveLength(1)
    const ring = mount(WebsiteCompactWidget, {
      props: { section: { ...metric, type: 'progress-ring', value: 75 } },
    })
    expect(ring.find('[role="progressbar"]').attributes('aria-valuenow')).toBe('75')
    const spark = newSection('sparkline')
    spark.items = [
      { ...newItem(), title: 'First', value: 0 },
      { ...newItem(), title: 'Second', value: -5 },
    ]
    const trend = mount(WebsiteCompactWidget, { props: { section: spark } })
    expect(trend.findAll('tbody td').map((cell) => cell.text())).toEqual(['0', '-5'])
    expect(trend.find('details').attributes('open')).toBeUndefined()
    expect(trend.find('svg').attributes('role')).toBe('img')
  })
  it('renders optional table values and closes areas against the numeric zero baseline', () => {
    const table = newSection('data-table')
    table.items = [{ ...newItem(), title: 'Status', text: '<script>active</script>' }]
    expect(blockErrors(table)).toEqual([])
    const wrapper = mount(WebsiteCompactWidget, { props: { section: table } })
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.findAll('tbody td').map((cell) => cell.text())).toEqual([
      '<script>active</script>',
      '',
    ])
    const graph = newSection('chart')
    graph.blockOptions = { chartType: 'area', showData: false }
    graph.items = [
      { ...newItem(), title: 'One', value: -10 },
      { ...newItem(), title: 'Two', value: 30 },
    ]
    const area = mount(WebsiteChart, { props: { section: graph } })
    expect(area.find('polygon').attributes('points')).toContain(
      `40,${chartGeometry([-10, 30]).zeroY}`,
    )
    expect(area.find('details').attributes('open')).toBeUndefined()
  })
})
