import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TimecardWorkspaceShell from '@/components/timecards/TimecardWorkspaceShell.vue'

describe('TimecardWorkspaceShell', () => {
  it('renders the shared timecard page chrome around workflow content', () => {
    const wrapper = mount(TimecardWorkspaceShell, {
      props: {
        testId: 'timecards-page',
      },
      slots: {
        default: '<p data-testid="workflow-content">Workbook content</p>',
      },
    })

    expect(wrapper.get('[data-testid="timecards-page"]').classes()).toContain('timecards-page')
    expect(wrapper.get('.timecards-workbook').text()).toContain('Workbook content')
    expect(wrapper.find('[data-testid="workflow-content"]').exists()).toBe(true)
  })
})
