import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppAlert from '@/components/common/AppAlert.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppLoadingState from '@/components/common/AppLoadingState.vue'
import AppModuleCard from '@/components/common/AppModuleCard.vue'
import AppToolbarCard from '@/components/common/AppToolbarCard.vue'

describe('app state components', () => {
  it('renders dismissible alerts and emits close events', async () => {
    const wrapper = mount(AppAlert, {
      props: {
        variant: 'danger',
        title: 'Error:',
        message: 'Something failed',
        dismissible: true,
      },
    })

    expect(wrapper.classes()).toContain('alert-danger')
    expect(wrapper.text().replace(/\s+/g, ' ').trim()).toContain('Error: Something failed')

    await wrapper.get('button.btn-close').trigger('click')

    expect(wrapper.emitted('close')).toEqual([[]])
  })

  it('renders icon alerts with body classes', () => {
    const wrapper = mount(AppAlert, {
      props: {
        variant: 'info',
        icon: 'bi bi-info-circle',
        iconClass: 'mt-1',
        message: 'Helpful note',
        bodyClass: 'small',
      },
    })

    expect(wrapper.find('.alert-info').exists()).toBe(true)
    expect(wrapper.find('.d-flex.align-items-start.gap-2').exists()).toBe(true)
    expect(wrapper.find('.bi.bi-info-circle.mt-1').exists()).toBe(true)
    expect(wrapper.find('.small').text()).toContain('Helpful note')
  })

  it('renders loading state messaging', () => {
    const wrapper = mount(AppLoadingState, {
      props: {
        srLabel: 'Loading records',
        message: 'Loading records...',
        spinnerClass: 'mb-3',
      },
    })

    expect(wrapper.text()).toContain('Loading records...')
    expect(wrapper.find('.spinner-border.mb-3').exists()).toBe(true)
    expect(wrapper.find('.visually-hidden').text()).toBe('Loading records')
  })

  it('renders empty state content with icon, title, and message', () => {
    const wrapper = mount(AppEmptyState, {
      props: {
        icon: 'bi bi-inbox',
        iconClass: 'fs-4',
        title: 'No records',
        message: 'Create one to get started.',
        compact: true,
      },
    })

    expect(wrapper.classes()).toContain('py-3')
    expect(wrapper.find('.app-empty-state-icon').classes()).toEqual(
      expect.arrayContaining(['bi', 'bi-inbox', 'fs-4']),
    )
    expect(wrapper.find('.app-empty-state-title').text()).toBe('No records')
    expect(wrapper.find('.app-empty-state-message').text()).toBe('Create one to get started.')
  })

  it('renders toolbar card header and body slots', () => {
    const wrapper = mount(AppToolbarCard, {
      props: {
        bodyClass: 'd-flex gap-2',
        headerClass: 'justify-content-between',
      },
      slots: {
        header: '<div>Filters</div>',
        default: '<button type="button">Apply</button>',
      },
    })

    expect(wrapper.classes()).toContain('app-toolbar-card')
    expect(wrapper.get('.card-header').classes()).toContain('justify-content-between')
    expect(wrapper.get('.card-header').text()).toContain('Filters')
    expect(wrapper.get('.card-body').classes()).toContain('d-flex')
    expect(wrapper.get('.card-body').text()).toContain('Apply')
  })

  it('renders module cards with route links', () => {
    const wrapper = mount(AppModuleCard, {
      props: {
        title: 'Daily Logs',
        description: 'Enter and review daily notes for this job.',
        icon: 'bi bi-journal-text',
        iconClass: 'text-primary',
        to: { name: 'job-daily-logs', params: { jobId: 'job-1' } },
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="JSON.stringify(to)"><slot /></a>',
          },
        },
      },
    })

    expect(wrapper.classes()).toContain('app-module-card')
    expect(wrapper.find('.card-title').text()).toContain('Daily Logs')
    expect(wrapper.find('.bi.bi-journal-text.text-primary').exists()).toBe(true)
    expect(wrapper.text()).toContain('Enter and review daily notes for this job.')
    expect(wrapper.get('a').text()).toContain('Open')
  })
})
