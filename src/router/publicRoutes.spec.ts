import { describe, expect, it } from 'vitest'
import router from './index'
describe('clean public pages preserve existing app routes', () => {
  it('resolves public pages independently without shadowing functional app routes', () => {
    for (const path of ['/', '/company', '/services', '/safety']) expect(router.resolve(path).name).toBe('public-website')
    for (const path of ['/login', '/forgot-password', '/set-password', '/admin/forms', '/admin/website', '/forms/example', '/form-submissions/example', '/reports', '/company-library', '/jobs', '/jobs/example/shop-orders', '/jobs/example/daily-logs', '/jobs/example/timecards', '/users', '/employees', '/safety/sds', '/exports/timecards', '/settings/shop-catalog', '/dashboards/personal']) expect(router.resolve(path).name, path).not.toBe('public-website')
  })
  it('keeps query/fragment in the legacy router redirect', () => {
    const legacy = router.resolve('/website/company?source=email#people')
    const redirect = legacy.matched[0]!.redirect as (to: typeof legacy) => unknown
    expect(redirect(legacy)).toEqual({ path: '/company', query: { source: 'email' }, hash: '#people' })
  })
})
