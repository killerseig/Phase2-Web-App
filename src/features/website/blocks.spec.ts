import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import {
  blockErrors,
  validateBlockItem,
  validateBlockOptions,
} from '../../../functions/src/websiteBlocks'
import { chartGeometry } from './charts'
import { newSection, newItem } from './types'
import WebsiteChart from '@/components/website/WebsiteChart.vue'
import WebsiteBlocks from '@/components/website/WebsiteBlocks.vue'

describe('website component widgets', () => {
  it('validates numeric content, icon choices, column counts and donut/progress constraints', () => {
    for (const value of [NaN, Infinity, 1e10, '10'])
      expect(() => validateBlockItem({ value })).toThrow()
    expect(() => validateBlockItem({ icon: 'star onclick=alert(1)' })).toThrow()
    expect(validateBlockItem({ icon: 'shield', subtitle: ' Safety ', value: 0 })).toEqual({
      icon: 'shield',
      subtitle: 'Safety',
      value: 0,
    })
    for (const options of [
      { columns: 0 },
      { columns: 1.5 },
      { chartType: 'script' },
      { unknown: true },
    ])
      expect(() => validateBlockOptions(options)).toThrow()
    const chart = newSection('chart')
    chart.blockOptions = { chartType: 'donut' }
    chart.items = [{ ...newItem(), title: 'First', value: 0 }]
    expect(blockErrors(chart)).toContain(
      'Donut charts need nonnegative values and at least one positive value.',
    )
    chart.items[0]!.value = -3
    expect(blockErrors(chart)).not.toEqual([])
    chart.blockOptions.chartType = 'line'
    expect(blockErrors(chart)).toEqual([])
    chart.type = 'progress'
    expect(blockErrors(chart)).toContain('Progress values must be between 0 and 100.')
    chart.items[0]!.value = 100
    expect(blockErrors(chart)).toEqual([])
  })
  it('keeps zero, negative and single-point charts finite and proportional', () => {
    const mixed = chartGeometry([-10, 30])
    expect(mixed.points[0]!.barX).toBeLessThan(mixed.zero)
    expect(mixed.points[1]!.barX).toBeGreaterThan(mixed.zero)
    expect(chartGeometry([25, 75]).points.map((point) => point.share)).toEqual([25, 75])
    expect(chartGeometry([25, 75]).points[1]!.offset).toBe(25)
    for (const values of [[], [0], [0, 0], [5], [-5, -3]])
      for (const point of chartGeometry(values).points)
        expect(Object.values(point).every(Number.isFinite)).toBe(true)
  })
  it('renders all chart modes with the exact values in an accessible table', () => {
    const section = newSection('chart')
    section.items = [
      { ...newItem(), title: '<script>first</script>', value: 25 },
      { ...newItem(), title: 'Second', value: 75 },
    ]
    for (const chartType of ['bar', 'line', 'donut'] as const) {
      section.blockOptions = { chartType }
      const wrapper = mount(WebsiteChart, { props: { section } })
      expect(wrapper.find('svg').attributes('role')).toBe('img')
      expect(wrapper.findAll('tbody tr')).toHaveLength(2)
      expect(wrapper.findAll('td').map((cell) => cell.text())).toEqual(['25', '75'])
      expect(wrapper.find('script').exists()).toBe(false)
      wrapper.unmount()
    }
  })
  it('keeps a spacer empty publicly and exposes progress through native controls', () => {
    const spacer = mount(WebsiteBlocks, { props: { section: newSection('spacer') } })
    expect(spacer.text()).toBe('')
    expect(spacer.find('.spacer').attributes('aria-hidden')).toBe('true')
    const section = newSection('progress')
    section.items = [{ ...newItem(), title: 'Complete', value: 40 }]
    const progress = mount(WebsiteBlocks, { props: { section } })
    expect(progress.find('progress').attributes('value')).toBe('40')
    expect(progress.find('label').text()).toContain('Complete: 40%')
  })
})
