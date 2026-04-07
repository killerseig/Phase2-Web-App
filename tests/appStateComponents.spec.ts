import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppAlert from '@/components/common/AppAlert.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppListCard from '@/components/common/AppListCard.vue'
import AppDataGroupCard from '@/components/common/AppDataGroupCard.vue'
import AppDataGroupHeader from '@/components/common/AppDataGroupHeader.vue'
import AppLoadingState from '@/components/common/AppLoadingState.vue'
import AppModuleCard from '@/components/common/AppModuleCard.vue'
import AppSearchToolbar from '@/components/common/AppSearchToolbar.vue'
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import AppSelectableListItem from '@/components/common/AppSelectableListItem.vue'
import AppStatCard from '@/components/common/AppStatCard.vue'
import AppToolbarCard from '@/components/common/AppToolbarCard.vue'
import AppToolbarMeta from '@/components/common/AppToolbarMeta.vue'
import AppToolbarSummary from '@/components/common/AppToolbarSummary.vue'
import BaseCard from '@/components/common/BaseCard.vue'

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

  it('renders grouped headers and cards with shared summary slots', () => {
    const header = mount(AppDataGroupHeader, {
      props: {
        eyebrow: 'Job',
        title: 'Alpha Build',
        subtitle: '2 matching timecards',
      },
      slots: {
        summary: '<div class="summary-content">Draft 1 | Submitted 1</div>',
      },
    })

    const card = mount(AppDataGroupCard, {
      props: {
        eyebrow: 'Created By',
        title: 'Pat Foreman',
        subtitle: '1 timecard',
        tone: 'accent',
      },
      slots: {
        summary: '<div class="summary-content">Totals</div>',
        default: '<div>Grouped body</div>',
      },
    })

    expect(header.text()).toContain('Alpha Build')
    expect(header.text()).toContain('2 matching timecards')
    expect(header.text()).toContain('Draft 1 | Submitted 1')
    expect(card.classes()).toContain('app-data-group-card')
    expect(card.classes()).toContain('app-data-group-card--accent')
    expect(card.text()).toContain('Pat Foreman')
    expect(card.text()).toContain('Grouped body')
    expect(card.text()).toContain('Totals')
  })

  it('renders shared stat cards with tone and helper text', () => {
    const wrapper = mount(AppStatCard, {
      props: {
        label: 'Submitted',
        value: 12,
        helperText: 'Matching results',
        valueClass: 'text-success',
        tone: 'accent',
      },
    })

    expect(wrapper.classes()).toContain('app-stat-card')
    expect(wrapper.classes()).toContain('app-stat-card--accent')
    expect(wrapper.text()).toContain('Submitted')
    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('Matching results')
    expect(wrapper.find('.app-stat-card__value').classes()).toContain('text-success')
  })

  it('renders shared search toolbars with optional extra fields', async () => {
    const wrapper = mount(AppSearchToolbar, {
      props: {
        modelValue: 'gloves',
        placeholder: 'Search catalog',
        searchColClass: 'col-md-6',
      },
      slots: {
        default: '<div class="col-md-6"><select><option>All</option></select></div>',
      },
    })

    expect(wrapper.find('.app-search-toolbar__body').exists()).toBe(true)
    expect(wrapper.find('input[placeholder="Search catalog"]').exists()).toBe(true)
    expect(wrapper.find('select').exists()).toBe(true)

    await wrapper.get('input').setValue('anchors')

    expect(wrapper.emitted('update:modelValue')).toEqual([['anchors']])
  })

  it('renders selectable list items and emits activate for click and keyboard', async () => {
    const wrapper = mount(AppSelectableListItem, {
      props: {
        selected: true,
      },
      slots: {
        default: '<span>Order A</span>',
      },
    })

    expect(wrapper.classes()).toContain('app-selectable-list-item')
    expect(wrapper.classes()).toContain('app-selectable-list-item--selected')
    expect(wrapper.attributes('role')).toBe('button')
    expect(wrapper.attributes('tabindex')).toBe('0')

    await wrapper.trigger('click')
    await wrapper.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('activate')).toHaveLength(2)
  })

  it('renders shared toolbar meta and summary shells', () => {
    const meta = mount(AppToolbarMeta, {
      props: {
        eyebrow: 'Search Filters',
        title: 'Find Timecards',
        subtitle: 'Downloads use the active filters.',
      },
    })

    const summary = mount(AppToolbarSummary, {
      props: {
        compact: true,
      },
      slots: {
        default: `
          <div class="app-toolbar-summary__line">
            <span class="app-toolbar-summary__kicker">Weeks</span>
            <span>Mar 8 to Mar 14</span>
          </div>
        `,
      },
    })

    expect(meta.text()).toContain('Search Filters')
    expect(meta.text()).toContain('Find Timecards')
    expect(meta.text()).toContain('Downloads use the active filters.')
    expect(summary.classes()).toContain('app-toolbar-summary--compact')
    expect(summary.text()).toContain('Weeks')
    expect(summary.text()).toContain('Mar 8 to Mar 14')
  })

  it('renders section cards with shared title, icon, and state handling', () => {
    const wrapper = mount(AppSectionCard, {
      props: {
        title: 'Catalog',
        subtitle: 'Browse available items',
        icon: 'bi bi-info-circle',
      },
      slots: {
        default: '<div>Section Body</div>',
      },
    })

    expect(wrapper.classes()).toContain('app-section-card')
    expect(wrapper.find('.card-header').text()).toContain('Catalog')
    expect(wrapper.find('.card-header').text()).toContain('Browse available items')
    expect(wrapper.find('.bi.bi-info-circle').exists()).toBe(true)
    expect(wrapper.get('.card-body').text()).toContain('Section Body')
  })

  it('renders list cards with badge and header actions', () => {
    const wrapper = mount(AppListCard, {
      props: {
        title: 'Orders',
        icon: 'bi bi-bag',
        badgeLabel: 3,
        muted: true,
      },
      slots: {
        'header-actions': '<button type="button">Refresh</button>',
        default: '<div class="list-group"><div class="list-group-item">Order A</div></div>',
      },
    })

    expect(wrapper.classes()).toContain('app-list-card')
    expect(wrapper.classes()).toContain('panel-muted')
    expect(wrapper.text()).toContain('Orders')
    expect(wrapper.find('.bi.bi-bag').exists()).toBe(true)
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('Refresh')
    expect(wrapper.text()).toContain('Order A')
  })

  it('renders shared base card sections', () => {
    const wrapper = mount(BaseCard, {
      props: {
        cardClass: 'custom-card',
        headerClass: 'justify-content-between',
        bodyClass: 'd-flex',
        footerClass: 'text-end',
      },
      slots: {
        header: '<div>Header Content</div>',
        default: '<div>Body Content</div>',
        footer: '<button type="button">Done</button>',
      },
    })

    expect(wrapper.classes()).toContain('card')
    expect(wrapper.classes()).toContain('custom-card')
    expect(wrapper.get('.card-header').classes()).toContain('panel-header')
    expect(wrapper.get('.card-header').classes()).toContain('justify-content-between')
    expect(wrapper.get('.card-body').classes()).toContain('d-flex')
    expect(wrapper.get('.card-footer').classes()).toContain('panel-footer')
    expect(wrapper.get('.card-footer').classes()).toContain('text-end')
    expect(wrapper.text()).toContain('Header Content')
    expect(wrapper.text()).toContain('Body Content')
    expect(wrapper.text()).toContain('Done')
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
