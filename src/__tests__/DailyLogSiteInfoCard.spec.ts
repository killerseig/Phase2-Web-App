import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DailyLogSiteInfoCard from '@/components/dailyLogs/DailyLogSiteInfoCard.vue'
import { DAILY_LOG_SITE_INFO_FIELDS } from '@/features/dailyLogs/schema'

const siteInfo = {
  projectName: 'Phase 2 Company Acoustical remodel',
  jobNumber: '1A',
  projectManager: 'Chris Renn',
  foreman: 'CJ Blanchard',
  generalContractor: '',
  address: '123 Main St',
}

describe('DailyLogSiteInfoCard', () => {
  it('renders schema-driven site info labels and values with blank fallbacks', () => {
    const wrapper = mount(DailyLogSiteInfoCard, {
      props: {
        fields: DAILY_LOG_SITE_INFO_FIELDS,
        siteInfo,
      },
    })

    expect(wrapper.text()).toContain('Site Info')
    expect(wrapper.text()).toContain('Project Name')
    expect(wrapper.text()).toContain('Phase 2 Company Acoustical remodel')
    expect(wrapper.text()).toContain('Job Number')
    expect(wrapper.text()).toContain('1A')
    expect(wrapper.text()).toContain('Project Manager')
    expect(wrapper.text()).toContain('Chris Renn')
    expect(wrapper.text()).toContain('Foreman')
    expect(wrapper.text()).toContain('CJ Blanchard')
    expect(wrapper.text()).toContain('General Contractor')
    expect(wrapper.text()).toContain('Job Address')
    expect(wrapper.text()).toContain('123 Main St')
    expect(wrapper.findAll('.daily-log-site-info-card__value').map((field) => field.text())).toContain('-')
  })

  it('respects a narrower field list from the parent route', () => {
    const wrapper = mount(DailyLogSiteInfoCard, {
      props: {
        fields: DAILY_LOG_SITE_INFO_FIELDS.slice(0, 2),
        siteInfo,
      },
    })

    expect(wrapper.text()).toContain('Project Name')
    expect(wrapper.text()).toContain('Job Number')
    expect(wrapper.text()).not.toContain('Project Manager')
    expect(wrapper.findAll('.daily-log-site-info-card__field')).toHaveLength(2)
  })
})
