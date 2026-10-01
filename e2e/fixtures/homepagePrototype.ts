// Review fixture only. No draft, assets or public content are written to Firebase.
import type { WebsiteSection, WebsiteSite } from '../../src/features/website/types'
export function homepagePrototype(): WebsiteSite {
  function widget(
    type: WebsiteSection['type'],
    title: string,
    extra: Partial<WebsiteSection> = {},
  ): WebsiteSection {
    return {
      id: crypto.randomUUID(),
      type,
      title,
      text: '',
      imageId: '',
      alt: '',
      linkLabel: '',
      linkUrl: '',
      hidden: false,
      items: [],
      ...extra,
    }
  }
  function navigation() {
    return widget('navigation', 'Navigation', {
      appearance: { padding: 18, background: '#ffffff' },
      navigation: { showBrand: true, showPages: true, showLogin: true, links: [] },
    })
  }
  function footer() {
    return widget('footer', 'Footer', {
      text: 'Prototype for review. Copy and photography are placeholders pending approval.',
      appearance: { background: '#102e3c', color: '#ffffff', padding: 24, radius: 10 },
      navigation: { showBrand: true, showPages: true, showLogin: false, links: [] },
    })
  }
  const hero = widget('hero', 'Built around the details.', {
    text: 'From the first conversation to the finishing touches. Explore the people, planning and work behind Phase 2.',
    imageId: 'prototype-construction',
    alt: 'Illustrative construction interior; placeholder image, not a documented Phase 2 project.',
    imageSettings: {
      darken: 10,
      overlayMode: 'linear',
      overlay: '#102e3c',
      overlayOpacity: 45,
      overlayAngle: 90,
    },
    linkLabel: 'Explore our work',
    linkUrl: '/website/projects',
    styleClass: 'custom-lead',
    appearance: {
      background: '#102e3c',
      color: '#ffffff',
      padding: 40,
      radius: 12,
      headingSize: 58,
    },
    devices: {
      mobile: { appearance: { padding: 22, headingSize: 38 } },
      tablet: { appearance: { padding: 28, headingSize: 46 } },
    },
  })
  const services = widget('container', 'Service cards', {
    container: { direction: 'row', gap: 18, align: 'stretch', wrap: false },
    appearance: { padding: 0, background: '#f4f6f8' },
    devices: { mobile: { container: { direction: 'column', gap: 16, align: 'stretch' } } },
  })
  const cards = [
    [
      'Preconstruction',
      'Start with a clear plan. Introduce estimating, budgeting and takeoff services here.',
    ],
    [
      'Our work',
      'Show what your team can do with approved project photography and concise project stories.',
    ],
    [
      'Our people',
      'Put faces to the work. Introduce the office and field teams behind each project.',
    ],
  ].map(([title, text], index) =>
    widget('card', title!, {
      text,
      parentId: services.id,
      linkLabel: 'Learn more',
      linkUrl: index === 1 ? '/website/projects' : '/website/company',
      appearance: {
        padding: 24,
        radius: 10,
        borderWidth: 1,
        borderColor: '#d7e0e8',
        headingSize: 25,
      },
      sizing: { grow: 1, basis: 33 },
    }),
  )
  const contact = widget('contact', 'Let’s talk about what comes next.', {
    text: 'Bring your project, question or next career move to Phase 2.',
    linkLabel: 'Get in touch',
    linkUrl: '/website/contact',
    appearance: { background: '#e4edf3', padding: 32, radius: 12, headingSize: 36 },
    devices: { mobile: { appearance: { padding: 22, headingSize: 28 } } },
  })
  const site: WebsiteSite = {
    name: 'Phase 2',
    accent: '#145b88',
    theme: {
      background: '#f4f6f8',
      surface: '#ffffff',
      text: '#172c40',
      muted: '#526779',
      border: '#d7e0e8',
      buttonText: '#ffffff',
      bodyFont: 'Source Sans 3',
      fontSize: 18,
      lineHeight: 1.6,
      radius: 6,
      contentWidth: 1200,
      headingFont: 'Saira Semi Condensed',
      spacing: 24,
    },
    branding: { logoId: '', logoAlt: '', footerText: '', footerLinks: [] },
    pages: [
      {
        id: 'prototype-home',
        title: 'Home',
        slug: 'home',
        description: 'A local design prototype for the Phase 2 company website.',
        inNavigation: true,
        chrome: 'widgets',
        layout: { desktop: 'flow', tablet: 'flow', mobile: 'flow' },
        css: '.custom-lead { flex-direction: row-reverse; } @media (max-width: 767px) { .custom-lead { flex-direction: column; } }',
        sections: [
          navigation(),
          hero,
          widget('text', 'Good work starts with a good foundation.', {
            text: 'Use this space to explain what makes Phase 2 the right partner. Keep the message clear, specific and supported by real work.',
            appearance: { padding: 12, background: '#f4f6f8', headingSize: 32 },
          }),
          services,
          ...cards,
          contact,
          footer(),
        ],
      },
    ],
  }
  for (const [title, slug] of [
    ['Company', 'company'],
    ['Projects', 'projects'],
    ['Careers', 'careers'],
    ['Contact', 'contact'],
  ])
    site.pages.push({
      id: `prototype-${slug}`,
      title: title!,
      slug: slug!,
      description: `${title} content preview for the local design prototype.`,
      inNavigation: true,
      chrome: 'widgets',
      layout: { desktop: 'flow', tablet: 'flow', mobile: 'flow' },
      sections: [
        navigation(),
        widget('hero', title!, {
          text: 'This page is reserved for approved company information. No production content has been published.',
          appearance: { padding: 32 },
        }),
        footer(),
      ],
    })
  return site
}
