import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppLoadingOverlay from './AppLoadingOverlay.vue'

describe('shared loading overlay', () => {
  it('announces loading and removes its overlay when work settles, including repeated loads', async () => {
    const view = mount(AppLoadingOverlay, { props: { loading: true, label: 'Loading documents' } })
    expect(view.get('[role="status"]').attributes('aria-live')).toBe('polite')
    expect(view.get('[role="status"]').text()).toBe('Loading documents')
    expect(view.get('.app-loading-indicator__wheel').attributes('aria-hidden')).toBe('true')
    await view.setProps({ loading: false })
    expect(view.find('.app-loading-overlay').exists()).toBe(false)
    await view.setProps({ loading: true })
    expect(view.find('.app-loading-overlay').exists()).toBe(true)
    view.unmount()
  })
})
