import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DailyLogAttachments from '@/components/dailyLogs/DailyLogAttachments.vue'
import DailyLogIndoorClimateCard from '@/components/dailyLogs/DailyLogIndoorClimateCard.vue'
import DailyLogManpower from '@/components/dailyLogs/DailyLogManpower.vue'
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
        qcPhotoDescription: 'Cracked joint at north wall',
        qcAssignedTo: '',
        qcAreasInspected: '',
        qcIssuesIdentified: '',
        qcIssuesResolved: '',
      },
    })

    const textareas = wrapper.findAll('textarea')
    await textareas[0]?.setValue('Jordan')
    await wrapper.find('input[type="file"]').trigger('change')
    await wrapper.find('.app-attachment-card button').trigger('click')

    expect(wrapper.findAll('.app-attachment-card')).toHaveLength(1)
    expect(wrapper.emitted('update:qcAssignedTo')).toEqual([['Jordan']])
    expect(wrapper.emitted('upload')).toHaveLength(1)
    expect(wrapper.emitted('delete-attachment')).toEqual([['qc/path']])
  })

  it('renders attachment galleries and forwards uploads/removals', async () => {
    const wrapper = mount(DailyLogAttachments, {
      props: {
        attachments: [
          { name: 'photo.png', path: 'photo/path', url: 'https://example.com/photo.png', type: 'photo' },
          { name: 'ptp.png', path: 'ptp/path', url: 'https://example.com/ptp.png', type: 'ptp' },
        ],
        canEdit: true,
        uploading: false,
        photoFileName: 'photo.png',
        ptpFileName: 'ptp.png',
        photoDescription: 'East elevation',
        ptpPhotoNote: 'Late arrival noted',
      },
    })

    const fileInputs = wrapper.findAll('input[type="file"]')
    await fileInputs[0]?.trigger('change')
    await wrapper.find('.app-attachment-card button').trigger('click')

    expect(fileInputs).toHaveLength(2)
    expect(wrapper.findAll('.app-attachment-card')).toHaveLength(2)
    expect(wrapper.emitted('upload')).toHaveLength(1)
    expect(wrapper.emitted('delete')).toEqual([['photo/path']])
  })

  it('forwards manpower row updates through dense table inputs', async () => {
    const wrapper = mount(DailyLogManpower, {
      props: {
        lines: [
          { trade: 'Carpenter', count: 1, areas: 'Level 1' },
          { trade: 'Laborer', count: 2, areas: 'Level 2' },
        ],
        canEdit: true,
        canDeleteLine: () => true,
        isAdminLine: () => false,
      },
    })

    const inputs = wrapper.findAll('input')
    await inputs[0]?.setValue('Electrician')
    await inputs[1]?.setValue('3')
    await wrapper.find('button[title="Delete row"]').trigger('click')

    expect(wrapper.emitted('update-field')).toEqual([[{ index: 0, field: 'trade', value: 'Electrician' }]])
    expect(wrapper.emitted('update-count')).toEqual([[{ index: 0, value: 3 }]])
    expect(wrapper.emitted('remove-line')).toEqual([[1]])
  })
})
