import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import DailyLogAttachmentCard from '@/components/dailyLogs/DailyLogAttachmentCard.vue'
import type { DailyLogAttachmentRecord } from '@/types/domain'

const attachments: DailyLogAttachmentRecord[] = [
  {
    name: 'photo.jpg',
    url: 'https://example.com/photo.jpg',
    path: 'daily-logs/log-1/photo.jpg',
    type: 'photo',
    description: 'Ceiling grid progress',
    createdAt: new Date('2026-06-11T14:30:00Z'),
  },
]

const uploadHandler = vi.fn<(entries: Array<{ file: File; description: string }>) => Promise<void>>(
  async () => undefined,
)

function mountAttachmentCard(
  overrides: Partial<InstanceType<typeof DailyLogAttachmentCard>['$props']> = {},
) {
  return shallowMount(DailyLogAttachmentCard, {
    props: {
      attachments,
      busy: false,
      chooseLabel: 'Choose Photos',
      descriptionLabel: 'Description',
      disabled: false,
      emptyLabel: 'Drag and drop photos here to upload.',
      helperText: 'Choose one or more photos.',
      title: 'Photos',
      uploadHandler,
      ...overrides,
    },
    global: {
      stubs: {
        AppCard: {
          props: ['as', 'id'],
          template: '<article :id="id"><slot /></article>',
        },
        ImageUploadPicker: {
          props: [
            'attachments',
            'busy',
            'chooseLabel',
            'descriptionLabel',
            'disabled',
            'emptyLabel',
            'helperText',
            'uploadHandler',
          ],
          emits: ['commit-description', 'remove', 'update-description'],
          template: `
            <section data-testid="image-upload-picker">
              <span data-testid="picker-choose-label">{{ chooseLabel }}</span>
              <span data-testid="picker-description-label">{{ descriptionLabel }}</span>
              <span data-testid="picker-empty-label">{{ emptyLabel }}</span>
              <span data-testid="picker-helper-text">{{ helperText }}</span>
              <span data-testid="picker-disabled">{{ String(disabled) }}</span>
              <span data-testid="picker-busy">{{ String(busy) }}</span>
              <span data-testid="picker-count">{{ attachments.length }}</span>
              <span data-testid="picker-upload-handler">{{ typeof uploadHandler }}</span>
              <button
                data-testid="picker-update-description"
                type="button"
                @click="$emit('update-description', { path: 'daily-logs/log-1/photo.jpg', description: 'Updated' })"
              >Update</button>
              <button data-testid="picker-commit-description" type="button" @click="$emit('commit-description')">
                Commit
              </button>
              <button
                data-testid="picker-remove"
                type="button"
                @click="$emit('remove', 'daily-logs/log-1/photo.jpg')"
              >Remove</button>
            </section>
          `,
        },
      },
    },
  })
}

describe('DailyLogAttachmentCard', () => {
  it('passes attachment picker configuration and state through to the upload picker', () => {
    const wrapper = mountAttachmentCard({
      anchorId: 'daily-log-photos',
      busy: true,
      disabled: true,
    })

    expect(wrapper.get('article').attributes('id')).toBe('daily-log-photos')
    expect(wrapper.text()).toContain('Photos')
    expect(wrapper.get('[data-testid="picker-choose-label"]').text()).toBe('Choose Photos')
    expect(wrapper.get('[data-testid="picker-description-label"]').text()).toBe('Description')
    expect(wrapper.get('[data-testid="picker-empty-label"]').text()).toBe(
      'Drag and drop photos here to upload.',
    )
    expect(wrapper.get('[data-testid="picker-helper-text"]').text()).toBe(
      'Choose one or more photos.',
    )
    expect(wrapper.get('[data-testid="picker-disabled"]').text()).toBe('true')
    expect(wrapper.get('[data-testid="picker-busy"]').text()).toBe('true')
    expect(wrapper.get('[data-testid="picker-count"]').text()).toBe('1')
    expect(wrapper.get('[data-testid="picker-upload-handler"]').text()).toBe('function')
  })

  it('forwards picker description, commit, and remove events to the parent route', async () => {
    const wrapper = mountAttachmentCard()

    await wrapper.get('[data-testid="picker-update-description"]').trigger('click')
    await wrapper.get('[data-testid="picker-commit-description"]').trigger('click')
    await wrapper.get('[data-testid="picker-remove"]').trigger('click')

    expect(wrapper.emitted('update-description')).toEqual([
      [{ path: 'daily-logs/log-1/photo.jpg', description: 'Updated' }],
    ])
    expect(wrapper.emitted('commit-description')).toHaveLength(1)
    expect(wrapper.emitted('remove')).toEqual([['daily-logs/log-1/photo.jpg']])
  })
})
