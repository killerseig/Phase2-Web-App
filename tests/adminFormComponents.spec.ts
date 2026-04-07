import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminAccordionFormCard from '@/components/admin/AdminAccordionFormCard.vue'
import ActionToggleGroup from '@/components/common/ActionToggleGroup.vue'
import BaseFormActions from '@/components/common/BaseFormActions.vue'
import BaseFormModal from '@/components/common/BaseFormModal.vue'
import InlineField from '@/components/common/InlineField.vue'

describe('admin form components', () => {
  it('renders shared form actions and emits cancel for button mode', async () => {
    const wrapper = mount(BaseFormActions, {
      props: {
        submitLabel: 'Create User',
        submitType: 'button',
      },
    })

    expect(wrapper.text()).toContain('Create User')

    const buttons = wrapper.findAll('button')
    await buttons[0]?.trigger('click')
    await buttons[1]?.trigger('click')

    expect(wrapper.emitted('cancel')).toEqual([[]])
    expect(wrapper.emitted('submit')).toEqual([[]])
  })

  it('wraps modal forms in the shared modal shell and emits actions', async () => {
    const wrapper = mount(BaseFormModal, {
      props: {
        open: true,
        title: 'Create User',
        submitLabel: 'Create User',
      },
      slots: {
        default: '<input id="user-email" value="" />',
      },
      global: {
        stubs: {
          BaseModal: {
            props: ['open', 'title'],
            emits: ['close'],
            template: `
              <div v-if="open" class="modal-stub">
                <div class="modal-title">{{ title }}</div>
                <slot />
                <slot name="footer" />
              </div>
            `,
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Create User')
    expect(wrapper.find('#user-email').exists()).toBe(true)

    const buttons = wrapper.findAll('button')
    await buttons[0]?.trigger('click')
    await buttons[1]?.trigger('click')

    expect(wrapper.emitted('cancel')).toEqual([[]])
    expect(wrapper.emitted('submit')).toEqual([[]])
  })

  it('wraps admin forms in the shared accordion shell', async () => {
    const wrapper = mount(AdminAccordionFormCard, {
      props: {
        open: true,
        title: 'Create User',
        subtitle: 'Add a new user account and set their role',
        submitLabel: 'Create User',
      },
      slots: {
        default: '<div class="col-12">Fields go here</div>',
      },
      global: {
        stubs: {
          BaseAccordionCard: {
            props: ['open', 'title', 'subtitle', 'bodyClass'],
            emits: ['update:open', 'toggle'],
            template: `
              <div class="accordion-stub">
                <div class="accordion-title">{{ title }}</div>
                <div class="accordion-subtitle">{{ subtitle }}</div>
                <slot />
              </div>
            `,
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Create User')
    expect(wrapper.text()).toContain('Fields go here')
    expect(wrapper.text()).toContain('Create User')

    await wrapper.findComponent(BaseFormActions).vm.$emit('cancel')

    expect(wrapper.emitted('cancel')).toEqual([[]])
  })

  it('renders shared admin row actions and emits toggle', async () => {
    const wrapper = mount(ActionToggleGroup, {
      props: {
        open: true,
        toggleDisabled: false,
      },
      slots: {
        default: '<button type="button" class="btn btn-outline-danger">Delete</button>',
      },
    })

    expect(wrapper.find('.btn-group').exists()).toBe(true)
    expect(wrapper.text()).toContain('Delete')

    const buttons = wrapper.findAll('button')
    await buttons[1]?.trigger('click')

    expect(wrapper.emitted('toggle')).toEqual([[]])
  })

  it('renders inline field editors and emits keyboard events', async () => {
    const wrapper = mount(InlineField, {
      props: {
        editing: true,
        modelValue: 'Initial',
        placeholder: 'First name',
      },
    })

    await wrapper.get('input').setValue('Updated')
    await wrapper.get('input').trigger('keydown', { key: 'Enter' })
    await wrapper.get('input').trigger('keydown', { key: 'Escape' })

    expect(wrapper.emitted('update:modelValue')).toEqual([['Updated']])
    expect(wrapper.emitted('enter')).toEqual([[]])
    expect(wrapper.emitted('escape')).toEqual([[]])
  })
})
