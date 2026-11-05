import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PrivateReferenceStatus from './PrivateReferenceStatus.vue'
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ rawRole: 'admin' }) }))

describe('reference loading controls', () => {
  it('removes cancellation while retaining loading, errors and a styled retry action', async () => {
    const view = mount(PrivateReferenceStatus, { props: { loading: true, error: '', notice: '', packages: [], selected: '', showEmptyState: false } })
    expect(view.get('[role="status"]').text()).toContain('Loading references')
    expect(view.find('button').exists()).toBe(false)
    await view.setProps({ loading: false, error: 'Reference unavailable' })
    expect(view.get('[role="alert"]').text()).toContain('Reference unavailable')
    expect(view.get('button').classes()).toContain('app-button')
    await view.get('button').trigger('click')
    expect(view.emitted('retry')).toHaveLength(1)
    expect(view.emitted('cancel')).toBeUndefined()
    view.unmount()
  })
})
