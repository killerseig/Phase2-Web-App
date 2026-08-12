import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi, type Mock } from 'vitest'

import ImageUploadPicker from '@/components/ImageUploadPicker.vue'
import type { DailyLogAttachmentRecord } from '@/types/domain'

const attachments: DailyLogAttachmentRecord[] = [
  {
    name: 'site-photo.jpg',
    url: 'https://example.com/site-photo.jpg',
    path: 'daily-logs/log-1/site-photo.jpg',
    type: 'photo',
    description: 'Existing description',
  },
]

type VoidMock = Mock<() => void>

function createFileUploadStub(chooseMock: VoidMock = vi.fn<() => void>(), clearMock: VoidMock = vi.fn<() => void>()) {
  return {
    name: 'FileUpload',
    props: ['name', 'accept', 'multiple', 'auto', 'customUpload', 'maxFileSize', 'disabled'],
    emits: ['select', 'uploader'],
    methods: {
      chooseCallback() {
        chooseMock()
      },
      clear() {
        clearMock()
      },
    },
    template: `
      <section data-testid="file-upload">
        <span data-testid="file-upload-name">{{ name }}</span>
        <span data-testid="file-upload-accept">{{ accept }}</span>
        <span data-testid="file-upload-multiple">{{ String(multiple) }}</span>
        <span data-testid="file-upload-auto">{{ String(auto) }}</span>
        <span data-testid="file-upload-custom-upload">{{ String(customUpload) }}</span>
        <span data-testid="file-upload-max-size">{{ String(maxFileSize) }}</span>
        <span data-testid="file-upload-disabled">{{ String(disabled) }}</span>
        <slot name="header" :chooseCallback="chooseCallback" />
        <slot name="content" :messages="['Built in warning']" />
      </section>
    `,
  }
}

const AppButtonStub = {
  name: 'AppButton',
  props: ['disabled', 'variant'],
  emits: ['click'],
  template: `<button type="button" :disabled="disabled" :data-variant="variant" @click="$emit('click')"><slot /></button>`,
}

const AppCardStub = {
  name: 'AppCard',
  props: ['as'],
  template: `<article><slot /></article>`,
}

const AppTextareaStub = {
  name: 'AppTextarea',
  props: ['modelValue', 'rows', 'disabled', 'placeholder'],
  emits: ['update:model-value', 'blur'],
  template: `
    <textarea
      :value="modelValue"
      :rows="rows"
      :disabled="disabled"
      :placeholder="placeholder"
      @input="$emit('update:model-value', $event.target.value)"
      @blur="$emit('blur')"
    />
  `,
}

function mountPicker(options: {
  props?: Partial<InstanceType<typeof ImageUploadPicker>['$props']>
  chooseMock?: VoidMock
  clearMock?: VoidMock
} = {}) {
  const chooseMock = options.chooseMock ?? vi.fn<() => void>()
  const clearMock = options.clearMock ?? vi.fn<() => void>()
  const uploadHandler = vi.fn(async () => undefined)

  const wrapper = mount(ImageUploadPicker, {
    props: {
      attachments: [],
      uploadHandler,
      ...options.props,
    },
    global: {
      stubs: {
        FileUpload: createFileUploadStub(chooseMock, clearMock),
        AppButton: AppButtonStub,
        AppCard: AppCardStub,
        AppTextarea: AppTextareaStub,
      },
    },
  })

  return { wrapper, uploadHandler, chooseMock, clearMock }
}

describe('ImageUploadPicker', () => {
  it('configures the upload control and renders empty/helper copy', async () => {
    const { wrapper, chooseMock } = mountPicker({
      props: {
        chooseLabel: 'Choose Photos',
        emptyLabel: 'Drop photos here.',
        helperText: 'Attach site photos.',
        maxFileSize: 1234,
      },
    })

    expect(wrapper.get('[data-testid="file-upload-name"]').text()).toBe('images[]')
    expect(wrapper.get('[data-testid="file-upload-accept"]').text()).toBe('image/*')
    expect(wrapper.get('[data-testid="file-upload-multiple"]').text()).toBe('true')
    expect(wrapper.get('[data-testid="file-upload-auto"]').text()).toBe('true')
    expect(wrapper.get('[data-testid="file-upload-custom-upload"]').text()).toBe('true')
    expect(wrapper.get('[data-testid="file-upload-max-size"]').text()).toBe('1234')
    expect(wrapper.get('[data-testid="file-upload-disabled"]').text()).toBe('false')
    expect(wrapper.text()).toContain('Attach site photos.')
    expect(wrapper.text()).toContain('Drop photos here.')
    expect(wrapper.text()).toContain('Choose Photos')

    await wrapper.get('button').trigger('click')

    expect(chooseMock).toHaveBeenCalledTimes(1)
  })

  it('uploads selected files as entries, clears the uploader, and suppresses upload while disabled or busy', async () => {
    const clearMock = vi.fn()
    const { wrapper, uploadHandler } = mountPicker({ clearMock })
    const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' })

    await wrapper.getComponent({ name: 'FileUpload' }).vm.$emit('uploader', { files: [file] })

    expect(uploadHandler).toHaveBeenCalledWith([{ file, description: '' }])
    expect(clearMock).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ disabled: true })
    await wrapper.getComponent({ name: 'FileUpload' }).vm.$emit('uploader', { files: [file] })
    await wrapper.setProps({ disabled: false, busy: true })
    await wrapper.getComponent({ name: 'FileUpload' }).vm.$emit('uploader', { files: [file] })

    expect(uploadHandler).toHaveBeenCalledTimes(1)
  })

  it('shows a local upload error and clears it when files are selected again', async () => {
    const failingUpload = vi.fn(async () => {
      throw new Error('Upload failed')
    })
    const { wrapper } = mountPicker({ props: { uploadHandler: failingUpload } })
    const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' })

    await wrapper.getComponent({ name: 'FileUpload' }).vm.$emit('uploader', { files: [file] })
    await flushPromises()

    expect(wrapper.text()).toContain('Built in warning')
    expect(wrapper.text()).toContain('Upload failed')

    await wrapper.getComponent({ name: 'FileUpload' }).vm.$emit('select', {})

    expect(wrapper.text()).toContain('Built in warning')
    expect(wrapper.text()).not.toContain('Upload failed')
  })

  it('renders saved attachments and forwards description, commit, and remove events', async () => {
    const { wrapper } = mountPicker({
      props: {
        attachments,
        descriptionLabel: 'Photo note',
      },
    })

    expect(wrapper.text()).toContain('site-photo.jpg')
    expect(wrapper.text()).toContain('Saved to draft')
    expect(wrapper.get<HTMLTextAreaElement>('textarea').element.value).toBe('Existing description')
    expect(wrapper.get('textarea').attributes('placeholder')).toBe('Photo note')

    await wrapper.get('textarea').setValue('Updated description')
    await wrapper.get('textarea').trigger('blur')
    await wrapper.findAll('button').find((button) => button.text() === 'Delete')!.trigger('click')

    expect(wrapper.emitted('updateDescription')).toEqual([
      [{ path: 'daily-logs/log-1/site-photo.jpg', description: 'Updated description' }],
    ])
    expect(wrapper.emitted('commitDescription')).toHaveLength(1)
    expect(wrapper.emitted('remove')).toEqual([['daily-logs/log-1/site-photo.jpg']])
  })

  it('opens and closes the attachment preview lightbox', async () => {
    const { wrapper } = mountPicker({ props: { attachments } })

    await wrapper.get('.image-upload-picker__preview-button').trigger('click')

    expect(wrapper.get('.image-upload-picker__lightbox-image').attributes('src')).toBe('https://example.com/site-photo.jpg')
    expect(wrapper.get('.image-upload-picker__lightbox-image').attributes('alt')).toBe('site-photo.jpg')
    expect(wrapper.text()).toContain('site-photo.jpg')

    await wrapper.get('.image-upload-picker__lightbox-close').trigger('click')

    expect(wrapper.find('.image-upload-picker__lightbox').exists()).toBe(false)
  })

  it('disables choose, description, remove, and upload controls while busy', () => {
    const { wrapper } = mountPicker({
      props: {
        attachments,
        busy: true,
      },
    })

    expect(wrapper.get('[data-testid="file-upload-disabled"]').text()).toBe('true')
    const buttons = wrapper.findAll('button')
    const deleteButton = buttons.find((button) => button.text() === 'Delete')

    expect(buttons[0]!.attributes('disabled')).toBeDefined()
    expect(deleteButton?.attributes('disabled')).toBeDefined()
    expect(wrapper.get('textarea').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.image-upload-picker__progress-track').exists()).toBe(true)
    expect(wrapper.find('.image-upload-picker__empty').exists()).toBe(false)
  })
})
