import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppBadge from '@/components/common/AppBadge.vue'
import DailyLogStatusBadge from '@/components/dailyLogs/DailyLogStatusBadge.vue'
import JobAccessBadge from '@/components/common/JobAccessBadge.vue'
import RoleBadge from '@/components/common/RoleBadge.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import CatalogRowColumns from '@/components/catalog/CatalogRowColumns.vue'
import TimecardWeekStatusBadge from '@/components/common/TimecardWeekStatusBadge.vue'
import ShopOrderStatusBadge from '@/components/shopOrders/ShopOrderStatusBadge.vue'
import TimecardStatusBadge from '@/components/timecards/TimecardStatusBadge.vue'
import { ROLES } from '@/constants/app'

describe('badge components', () => {
  it('renders the shared badge primitive with the expected classes', () => {
    const wrapper = mount(AppBadge, {
      props: {
        label: 'Draft',
        variantClass: 'text-bg-warning text-dark',
      },
    })

    expect(wrapper.text()).toContain('Draft')
    expect(wrapper.classes()).toContain('badge')
    expect(wrapper.classes()).toContain('app-badge-pill')
    expect(wrapper.classes()).toContain('app-badge-pill--sm')
    expect(wrapper.classes()).toContain('text-bg-warning')
  })

  it('renders role badges from the shared role map', () => {
    const wrapper = mount(RoleBadge, {
      props: {
        role: ROLES.ADMIN,
      },
    })

    expect(wrapper.text()).toContain('Admin')
    expect(wrapper.classes()).toContain('bg-danger')
  })

  it('renders status badges through the shared badge primitive', () => {
    const wrapper = mount(StatusBadge, {
      props: {
        status: 'archived',
      },
    })

    expect(wrapper.text()).toContain('Archived')
    expect(wrapper.classes()).toContain('text-bg-dark')
  })

  it('renders daily log badges with the feature-specific status labels', () => {
    const wrapper = mount(DailyLogStatusBadge, {
      props: {
        status: 'draft',
        autoSaved: true,
      },
    })

    expect(wrapper.text()).toContain('Draft (auto-saved)')
    expect(wrapper.classes()).toContain('text-bg-warning')
  })

  it('renders shared catalog row columns for archived, sku, and price', () => {
    const wrapper = mount(CatalogRowColumns, {
      props: {
        label: 'Anchor Kit',
        archived: true,
        sku: 'SKU-100',
        price: 0,
      },
    })

    expect(wrapper.text()).toContain('Anchor Kit')
    expect(wrapper.text()).toContain('Archived')
    expect(wrapper.text()).toContain('SKU-100')
    expect(wrapper.text()).toContain('$0.00')
    expect(wrapper.findAll('.catalog-row-columns__cell')).toHaveLength(2)
  })

  it('adds hover titles for truncated catalog labels and context', () => {
    const wrapper = mount(CatalogRowColumns, {
      props: {
        label: 'Very Long Guard Rail Description',
        context: 'Scaffolding > Perry Scaffold',
      },
    })

    expect(wrapper.get('.catalog-row-columns__label').attributes('title')).toBe('Very Long Guard Rail Description')
    expect(wrapper.get('.catalog-row-columns__context').attributes('title')).toBe('Scaffolding > Perry Scaffold')
  })

  it('renders the weekly timecard status badge for the current week', () => {
    const wrapper = mount(TimecardWeekStatusBadge, {
      props: {
        status: 'submitted',
        periodEndDate: '2026-03-21',
        currentWeekEnd: '2026-03-21',
        currentWeekLabel: 'Mar 15 - Mar 21',
      },
    })

    expect(wrapper.text()).toContain('Weekly timecards submitted')
    expect(wrapper.attributes('title')).toContain('Mar 15 - Mar 21')
    expect(wrapper.classes()).toContain('text-bg-success')
  })

  it('renders shop order status badges with the shared labels', () => {
    const wrapper = mount(ShopOrderStatusBadge, {
      props: {
        status: 'order',
      },
    })

    expect(wrapper.text()).toContain('Submitted')
    expect(wrapper.classes()).toContain('text-bg-primary')
  })

  it('renders editor timecard status badges with the editor variant styling', () => {
    const wrapper = mount(TimecardStatusBadge, {
      props: {
        status: 'draft',
        variant: 'editor',
      },
    })

    expect(wrapper.text()).toContain('Draft')
    expect(wrapper.classes()).toContain('bg-warning')
  })

  it('renders the correct job access chip with precedence', () => {
    const wrapper = mount(JobAccessBadge, {
      props: {
        isForeman: true,
        isAdmin: true,
        isOnRoster: true,
      },
    })

    expect(wrapper.text()).toContain('You are Foreman')
    expect(wrapper.find('.bi.bi-person-badge').exists()).toBe(true)
    expect(wrapper.classes()).toContain('bg-success')
  })
})
