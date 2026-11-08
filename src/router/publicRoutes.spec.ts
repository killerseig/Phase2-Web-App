import { describe, expect, it } from 'vitest'
import router from './index'
describe('clean public pages preserve existing app routes', () => {
  it('resolves public pages independently without shadowing functional app routes', () => {
    for (const path of ['/', '/company', '/services', '/safety']) expect(router.resolve(path).name).toBe('public-website')
    for (const path of ['/login', '/forgot-password', '/set-password', '/admin/forms', '/admin/website', '/forms/example', '/form-submissions/example', '/reports', '/company-library', '/jobs', '/jobs/example/shop-orders', '/jobs/example/daily-logs', '/jobs/example/timecards', '/users', '/employees', '/safety/sds', '/exports/timecards', '/settings/shop-catalog', '/dashboards/personal']) expect([path, router.resolve(path).name]).not.toEqual([path, 'public-website'])
  })
  it('keeps query/fragment in the legacy router redirect', () => {
    const legacy = router.resolve('/website/company?source=email#people')
    const redirect = legacy.matched[0]!.redirect as (to: typeof legacy) => unknown
    expect(redirect(legacy)).toEqual({ path: '/company', query: { source: 'email' }, hash: '#people' })
  })
  it('keeps old role-dashboard bookmarks on the canonical role workspace', () => {
    const legacy = router.resolve('/dashboards/role-home?source=bookmark#notes')
    const redirect = legacy.matched[0]!.redirect
    expect(typeof redirect).toBe('function')
    if (typeof redirect !== 'function') throw new Error('Role home must redirect to the existing role workspace.')
    expect(redirect(legacy)).toEqual({ name: 'role-workspace', query: { source: 'bookmark' }, hash: '#notes' })
    expect(router.resolve('/dashboard').name).toBe('dashboard')
    expect(router.resolve('/jobs/job-1').name).toBe('job-dashboard')
  })
})
