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
        staffingOptions: [
          { id: 'directory-1', label: 'Mateo Silva | #9001 | Laborer' },
        ],
        staffingError: '',
        staffingLoading: false,
        selectedStaffingEmployeeId: '',
        selectedStaffingEmployee: {
          id: 'directory-1',
          employeeNumber: '9001',
          firstName: 'Mateo',
          lastName: 'Silva',
          occupation: 'Laborer',
          active: true,
        },
        addingStaffingEmployee: false,
      },
      global: {
        stubs: {
          AppAlert: {
            props: ['message'],
            template: '<div class="alert-stub">{{ message }}</div>',
          },
          AppListCard: {
            template: '<div><slot /></div>',
          },
          BaseSearchField: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<input class="search-stub" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
          SearchSelectField: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<input class="staffing-search-stub" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
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

    await wrapper.get('.staffing-search-stub').setValue('directory-1')
    await wrapper.setProps({ selectedStaffingEmployeeId: 'directory-1' })
    await wrapper.get('button.btn-outline-primary').trigger('click')
    await wrapper.get('.search-stub').setValue('anselmo')
    await wrapper.get('.list-item-stub').trigger('click')

    expect(wrapper.emitted('update:selectedStaffingEmployeeId')).toEqual([['directory-1']])
    expect(wrapper.emitted('add-staffing-employee')).toEqual([[]])
    expect(wrapper.emitted('update:searchTerm')).toEqual([['anselmo']])
    expect(wrapper.emitted('select')).toEqual([['roster-1']])
    expect(wrapper.text()).toContain('Sub')
    expect(wrapper.text()).toContain('Mateo Silva')
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
