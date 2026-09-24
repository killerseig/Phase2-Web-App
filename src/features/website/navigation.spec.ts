import { describe, expect, it } from 'vitest'
import { navigationEntries, updateNavigationLabel } from './navigation'
import { newSection, type WebsiteSite } from './types'
describe('inline navigation labels', () => {
  it('keeps page, custom, dropdown and login identities separate and retains destinations', () => {
    const site: WebsiteSite = {
      name: 'Example',
      accent: '#174878',
      pages: [
        {
          id: 'same',
          title: 'Home',
          slug: 'home',
          inNavigation: true,
          description: '',
          sections: [],
        },
      ],
    }
    const settings = newSection('navigation').navigation!
    settings.showLogin = true
    settings.links = [
      {
        id: 'same',
        label: 'Menu',
        url: '',
        children: [{ id: 'same', label: 'Child', url: '/website' }],
      },
    ]
    updateNavigationLabel(settings, 'page:same', 'Start', undefined, site)
    updateNavigationLabel(settings, 'custom:same/same', 'Nested', undefined, site)
    updateNavigationLabel(settings, 'login', 'Sign in', undefined, site)
    const entries = navigationEntries(settings, site)
    expect(entries.map((entry) => [entry.key, entry.label, entry.url])).toEqual([
      ['page:same', 'Start', '/website'],
      ['custom:same', 'Menu', ''],
      ['login', 'Sign in', '/login'],
    ])
    expect(entries[1]!.children![0]).toMatchObject({
      key: 'custom:same/same',
      label: 'Nested',
      url: '/website',
    })
    expect(site.pages[0]!.title).toBe('Home')
    delete settings.pageLabels
    expect(navigationEntries(settings, site)[0]!.label).toBe('Home')
  })
})
