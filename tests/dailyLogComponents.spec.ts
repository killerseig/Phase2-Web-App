import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DailyLogIndoorClimateCard from '@/components/dailyLogs/DailyLogIndoorClimateCard.vue'
import DailyLogQualityControlCard from '@/components/dailyLogs/DailyLogQualityControlCard.vue'

describe('daily log components', () => {
  it('emits indoor climate field, add, and remove events', async () => {
    const wrapper = mount(DailyLogIndoorClimateCard, {
      props: {
        readings: [{ area: '', high: '70', low: '65', humidity: '40' }],
        canEdit: true,
      },
    })

    await wrapper.find('input[placeholder="e.g., Level 2"]').setValue('Level 1')
    await wrapper.find('.btn-outline-primary').trigger('click')
    await wrapper.find('.btn-outline-danger').trigger('click')

    expect(wrapper.emitted('update-field')).toEqual([[
      { index: 0, field: 'area', value: 'Level 1' },
    ]])
    expect(wrapper.emitted('add-reading')).toEqual([[]])
    expect(wrapper.emitted('remove-reading')).toEqual([[0]])
  })

  it('renders QC attachments and forwards edit actions', async () => {
    const wrapper = mount(DailyLogQualityControlCard, {
      props: {
        attachments: [
          { name: 'qc.png', path: 'qc/path', url: 'https://example.com/qc.png', type: 'qc' },
          { name: 'photo.png', path: 'photo/path', url: 'https://example.com/photo.png', type: 'photo' },
        ],
        canEdit: true,
        uploading: false,
        fileName: 'qc.png',
        qcAssignedTo: '',
        qcAreasInspected: '',
        qcIssuesIdentified: '',
        qcIssuesResolved: '',
      },
    })

    const textareas = wrapper.findAll('textarea')
    await textareas[0]?.setValue('Jordan')
    await wrapper.find('input[type="file"]').trigger('change')
    await wrapper.find('.thumb-card button').trigger('click')

    expect(wrapper.findAll('.thumb-card')).toHaveLength(1)
    expect(wrapper.emitted('update:qcAssignedTo')).toEqual([['Jordan']])
    expect(wrapper.emitted('upload')).toHaveLength(1)
    expect(wrapper.emitted('delete-attachment')).toEqual([['qc/path']])
  })
})
