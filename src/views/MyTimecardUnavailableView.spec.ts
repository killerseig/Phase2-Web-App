import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MyTimecardUnavailableView from './MyTimecardUnavailableView.vue'

describe('paused personal workspace', () => {
  it('explains the pause without exposing entry controls or linking unrelated workspaces', () => {
    const view = mount(MyTimecardUnavailableView, { global: { stubs: { AppShell: { template: '<main><slot /></main>' } } } })
    expect(view.text()).toContain('My Timecard is temporarily unavailable')
    expect(view.text()).toContain('Existing timecards are preserved')
    expect(view.findAll('input,select,textarea,button,a')).toHaveLength(0)
    view.unmount()
  })
})
