import { mount, RouterLinkStub } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AuthCard from '@/components/auth/AuthCard.vue'
import AuthFirebaseConfigWarning from '@/components/auth/AuthFirebaseConfigWarning.vue'
import AuthStatusMessage from '@/components/auth/AuthStatusMessage.vue'
import AuthSubmitButton from '@/components/auth/AuthSubmitButton.vue'
import AuthTextLink from '@/components/auth/AuthTextLink.vue'
import ModulePlaceholder from '@/components/ModulePlaceholder.vue'
import PagePanel from '@/components/PagePanel.vue'

describe('AuthCard', () => {
  it('renders auth page copy, accessible title wiring, optional copy, and slot content', () => {
    const wrapper = mount(AuthCard, {
      props: {
        eyebrow: 'Phase 2',
        title: 'Sign in',
        copy: 'Use your company account.',
      },
      slots: {
        default: '<form data-testid="auth-form">Form content</form>',
      },
    })

    expect(wrapper.find('.auth-page').exists()).toBe(true)
    expect(wrapper.get('.auth-card').attributes('aria-labelledby')).toBe('auth-card-title')
    expect(wrapper.get('#auth-card-title').text()).toBe('Sign in')
    expect(wrapper.get('.auth-card__eyebrow').text()).toBe('Phase 2')
    expect(wrapper.get('.auth-card__copy').text()).toBe('Use your company account.')
    expect(wrapper.get('[data-testid="auth-form"]').text()).toBe('Form content')
  })

  it('omits the copy paragraph when no copy is provided', () => {
    const wrapper = mount(AuthCard, {
      props: {
        eyebrow: 'Phase 2',
        title: 'Reset password',
      },
    })

    expect(wrapper.find('.auth-card__copy').exists()).toBe(false)
  })
})

describe('AuthFirebaseConfigWarning', () => {
  it('renders the shared Firebase configuration warning copy', () => {
    const wrapper = mount(AuthFirebaseConfigWarning)

    expect(wrapper.find('.app-status-message--warning').exists()).toBe(true)
    expect(wrapper.find('.auth-card__status').exists()).toBe(true)
    expect(wrapper.text()).toContain('Firebase is not configured yet.')
    expect(wrapper.text()).toContain('VITE_FIREBASE_*')
  })
})

describe('AuthStatusMessage', () => {
  it('renders auth-card status chrome with inherited status behavior', () => {
    const wrapper = mount(AuthStatusMessage, {
      props: {
        tone: 'warning',
      },
      slots: {
        default: 'Checking your current session...',
      },
    })

    expect(wrapper.find('.auth-card__status').exists()).toBe(true)
    expect(wrapper.find('.app-status-message--warning').exists()).toBe(true)
    expect(wrapper.get('[role="status"]').text()).toBe('Checking your current session...')
  })
})

describe('AuthSubmitButton', () => {
  it('renders the auth-card loading button contract', () => {
    const wrapper = mount(AuthSubmitButton, {
      props: {
        label: 'Login',
        loadingLabel: 'Signing In...',
        loading: true,
      },
    })

    const button = wrapper.get('button')
    expect(button.classes()).toContain('auth-card__button')
    expect(button.classes()).toContain('app-button--primary')
    expect(button.attributes('type')).toBe('submit')
    expect(button.attributes('aria-busy')).toBe('true')
    expect(button.text()).toBe('Signing In...')
  })
})

describe('AuthTextLink', () => {
  it('renders the auth-card text link contract', () => {
    const wrapper = mount(AuthTextLink, {
      props: {
        to: '/login',
      },
      slots: {
        default: 'Back to login',
      },
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
        },
      },
    })

    expect(wrapper.find('.auth-card__link').exists()).toBe(true)
    expect(wrapper.getComponent(RouterLinkStub).props('to')).toBe('/login')
    expect(wrapper.text()).toBe('Back to login')
  })
})

describe('PagePanel', () => {
  const AppPaneHeaderStub = {
    name: 'AppPaneHeader',
    props: ['eyebrow', 'title', 'titleTag', 'description'],
    template: `
      <header data-testid="pane-header">
        <span data-testid="pane-eyebrow">{{ eyebrow }}</span>
        <component :is="titleTag" data-testid="pane-title">{{ title }}</component>
        <p v-if="description" data-testid="pane-description">{{ description }}</p>
      </header>
    `,
  }

  it('renders the shared pane header and body slot', () => {
    const wrapper = mount(PagePanel, {
      props: {
        eyebrow: 'Admin',
        title: 'Jobs',
        description: 'Manage job records.',
      },
      slots: {
        default: '<div data-testid="panel-body">Panel body</div>',
      },
      global: {
        stubs: {
          AppPaneHeader: AppPaneHeaderStub,
        },
      },
    })

    expect(wrapper.find('section.page-panel').exists()).toBe(true)
    expect(wrapper.getComponent({ name: 'AppPaneHeader' }).props()).toMatchObject({
      eyebrow: 'Admin',
      title: 'Jobs',
      titleTag: 'h2',
      description: 'Manage job records.',
    })
    expect(wrapper.get('[data-testid="panel-body"]').text()).toBe('Panel body')
  })
})

describe('ModulePlaceholder', () => {
  it('renders placeholder copy and highlight cards', () => {
    const wrapper = mount(ModulePlaceholder, {
      props: {
        eyebrow: 'Coming Soon',
        title: 'Documents',
        description: 'Centralized job files will live here.',
        highlights: ['Pinned documents', 'Safety sheets', 'Photo gallery'],
      },
    })

    expect(wrapper.get('.module-placeholder__eyebrow').text()).toBe('Coming Soon')
    expect(wrapper.get('h2').text()).toBe('Documents')
    expect(wrapper.text()).toContain('Centralized job files will live here.')
    expect(wrapper.findAll('.module-placeholder__list-item').map((item) => item.text())).toEqual([
      'Pinned documents',
      'Safety sheets',
      'Photo gallery',
    ])
  })
})
