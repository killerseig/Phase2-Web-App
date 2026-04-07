import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TimecardEmployeeList from '@/components/timecards/TimecardEmployeeList.vue'
import TimecardWeekWorkspaceLayout from '@/components/timecards/TimecardWeekWorkspaceLayout.vue'

describe('timecard workspace components', () => {
  it('emits employee selection and search updates', async () => {
    const wrapper = mount(TimecardEmployeeList, {
      props: {
        items: [
          {
            employeeId: 'roster-1',
            timecardId: 'tc-1',
            employeeName: 'Anselmo Gutierrez',
            employeeNumber: '8060',
            occupation: 'Framer',
            subcontractedEmployee: true,
            status: 'draft',
            hoursTotal: 16,
            productionTotal: 39,
          },
        ],
        selectedEmployeeId: 'roster-1',
        searchTerm: '',
      },
      global: {
        stubs: {
          AppListCard: {
            template: '<div><slot /></div>',
          },
          BaseSearchField: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<input class="search-stub" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
          AppSelectableListItem: {
            emits: ['activate'],
            template: '<button class="list-item-stub" @click="$emit(\'activate\')"><slot /></button>',
          },
          TimecardStatusBadge: {
            props: ['status'],
            template: '<span class="status-stub">{{ status }}</span>',
          },
          AppBadge: {
            props: ['label'],
            template: '<span class="badge-stub">{{ label }}</span>',
          },
          AppEmptyState: {
            template: '<div class="empty-stub"></div>',
          },
        },
      },
    })

    await wrapper.get('.search-stub').setValue('anselmo')
    await wrapper.get('.list-item-stub').trigger('click')

    expect(wrapper.emitted('update:searchTerm')).toEqual([['anselmo']])
    expect(wrapper.emitted('select')).toEqual([['roster-1']])
    expect(wrapper.text()).toContain('Sub')
  })

  it('renders the workspace slots', () => {
    const wrapper = mount(TimecardWeekWorkspaceLayout, {
      slots: {
        browser: '<div class="browser-slot">Browser</div>',
        default: '<div class="main-slot">Main</div>',
        controls: '<div class="controls-slot">Controls</div>',
      },
    })

    expect(wrapper.find('.browser-slot').exists()).toBe(true)
    expect(wrapper.find('.main-slot').exists()).toBe(true)
    expect(wrapper.find('.controls-slot').exists()).toBe(true)
    expect(wrapper.classes()).toContain('app-master-detail-workspace')
    expect(wrapper.find('.app-master-detail-workspace__browser').text()).toContain('Browser')
    expect(wrapper.find('.app-master-detail-workspace__controls').text()).toContain('Controls')
  })
})
