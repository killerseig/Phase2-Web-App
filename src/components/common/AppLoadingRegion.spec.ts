import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppLoadingRegion from './AppLoadingRegion.vue'
import AppLoadingOverlay from './AppLoadingOverlay.vue'

describe('shared body loading region', () => {
  it('keeps loading centered within its region and releases content when settled', async () => {
    const view = mount(AppLoadingRegion, { props: { loading: true, label: 'Loading forms' }, slots: { default: '<button>Open form</button>' } })
    expect(view.get('section').attributes('aria-busy')).toBe('true')
    expect(view.get('.app-loading-region__content').attributes('inert')).toBeDefined()
    expect(view.get('.app-loading-region__content').classes()).toContain('is-loading')
    expect(view.get('[role="status"]').text()).toBe('Loading forms')
    await view.setProps({ loading: false })
    expect(view.get('section').attributes('aria-busy')).toBe('true')
    expect(view.get('.app-loading-region__content').attributes('inert')).toBeDefined()
    view.getComponent(AppLoadingOverlay).vm.$emit('afterLeave')
    await view.vm.$nextTick()
    expect(view.get('section').attributes('aria-busy')).toBe('false')
    expect(view.get('.app-loading-region__content').attributes('inert')).toBeUndefined()
    expect(view.get('.app-loading-region__content').classes()).not.toContain('is-loading')
    expect(view.find('.app-loading-overlay').exists()).toBe(false)
    view.unmount()
  })
})


it('keeps a new load covered if an earlier exit completes during re-entry', async () => {
  const view = mount(AppLoadingRegion, { props: { loading: true } })
  await view.setProps({ loading: false })
  await view.setProps({ loading: true })
  view.getComponent(AppLoadingOverlay).vm.$emit('afterLeave')
  await view.vm.$nextTick()
  expect(view.get('section').attributes('aria-busy')).toBe('true')
  expect(view.get('.app-loading-region__content').attributes('inert')).toBeDefined()
  await view.setProps({ loading: false })
  view.getComponent(AppLoadingOverlay).vm.$emit('afterLeave')
  await view.vm.$nextTick()
  expect(view.get('section').attributes('aria-busy')).toBe('false')
  view.unmount()
})
