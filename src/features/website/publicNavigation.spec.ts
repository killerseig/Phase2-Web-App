import { describe, expect, it, vi } from 'vitest'
import { installPublicNavigation } from './publicNavigation'
import type { Router } from 'vue-router'
describe('public-only navigation', () => {
  it('keeps public links in-app and preserves login, external links, downloads and new-tab actions', () => {
    const push = vi.fn(), root = document.createElement('div'); document.body.appendChild(root)
    const cleanup = installPublicNavigation({ push } as unknown as Router, root)
    function click(href: string, options = {}, attributes = '') {
      root.innerHTML = `<a href="${href}" ${attributes}>Open</a>`
      return root.querySelector('a')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...options }))
    }
    expect(click('/website/company')).toBe(false); expect(push).toHaveBeenCalledWith('/company')
    for (const href of ['/login', '/jobs', '/company-library', 'https://elsewhere.invalid/']) click(href)
    click('/website/company', { ctrlKey: true }); click('/website/company', {}, 'target="_blank"'); click('/website/company', {}, 'download')
    expect(push).toHaveBeenCalledOnce(); cleanup(); root.remove()
  })
})
