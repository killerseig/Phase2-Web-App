import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SubmissionCountBadges from '@/components/common/SubmissionCountBadges.vue'

describe('SubmissionCountBadges', () => {
  it('renders draft and submitted badge counts', () => {
    const wrapper = mount(SubmissionCountBadges, {
      props: {
        draftCount: 3,
        submittedCount: 5,
        wrapperClass: 'small text-muted',
      },
    })

    expect(wrapper.classes()).toContain('small')
    expect(wrapper.text()).toContain('3 Draft')
    expect(wrapper.text()).toContain('5 Submitted')
  })
})
