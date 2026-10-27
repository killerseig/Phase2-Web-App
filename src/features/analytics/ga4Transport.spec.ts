import { afterEach, describe, expect, it, vi } from 'vitest'
import { ga4Transport } from './ga4Transport'
import type { ReadyDestination, UsageEvent } from './usageAnalytics'
const destination = (scope: 'public' | 'employee'): ReadyDestination => ({ scope, origin: 'https://phase2.example', enabled: true, approved: true, hosts: ['phase2.example'], measurementId: scope === 'public' ? 'G-PUBLIC1234' : 'G-INTERNAL12' })
const event: UsageEvent = { scope: 'employee', name: 'feature_view', feature: 'library' }
const queue = () => (Reflect.get(window, 'dataLayer') as Array<ArrayLike<unknown>>).map(item => Array.from(item))
afterEach(() => {
  vi.restoreAllMocks()
  for (const key of ['dataLayer', '__phase2AnalyticsOwner', 'gtag', 'ga-disable-G-PUBLIC1234', 'ga-disable-G-INTERNAL12']) Reflect.deleteProperty(window, key)
})
describe('GA4 transport boundary without network access', () => {
  it('uses one explicit destination and synthetic metadata, without forwarding private browser URLs or caller extras', () => {
    // Capture the script node instead of inserting it: no third-party request can occur.
    const append = vi.spyOn(document.head, 'append').mockImplementation(() => {})
    window.history.replaceState({}, '', '/jobs/private-id?email=private@example.invalid&utm_campaign=private#secret')
    const transport = ga4Transport(destination('employee'))
    transport.send({ ...event, userId: 'private-id', formAnswer: 'secret' } as UsageEvent)
    const commands = queue(), payload = JSON.stringify(commands)
    expect(append).toHaveBeenCalledOnce()
    const script = append.mock.calls[0]![0] as HTMLScriptElement
    expect(script.src).toBe('https://www.googletagmanager.com/gtag/js?id=G-INTERNAL12')
    expect(script.referrerPolicy).toBe('no-referrer')
    expect(commands.find(command => command[0] === 'config')).toMatchObject(['config', 'G-INTERNAL12', { send_page_view: false, allow_google_signals: false, cookie_prefix: 'phase2_employee' }])
    expect(commands.find(command => command[0] === 'event')).toMatchObject(['event', 'feature_view', { send_to: 'G-INTERNAL12', feature_key: 'library', page_location: 'https://phase2.example/usage/employee/library', page_referrer: '', campaign_source: 'not_collected' }])
    expect(payload).not.toMatch(/private-id|private@example|secret|formAnswer|userId|G-PUBLIC1234/)
    transport.send(event); expect(append).toHaveBeenCalledOnce()
    transport.stop()
    expect(Reflect.get(window, 'ga-disable-G-INTERNAL12')).toBe(true)
    expect(queue()).toEqual([])
    transport.send(event); expect(queue()).toEqual([])
    window.history.replaceState({}, '', '/')
  })
  it('rejects cross-scope events and refuses to share a document with another destination or unrelated tag', () => {
    const append = vi.spyOn(document.head, 'append').mockImplementation(() => {})
    const transport = ga4Transport(destination('public'))
    transport.send(event)
    expect(append).not.toHaveBeenCalled()
    expect(() => ga4Transport(destination('employee'))).toThrow('unrelated analytics destination')
    transport.stop(); Reflect.deleteProperty(window, '__phase2AnalyticsOwner')
    Reflect.set(window, 'gtag', () => {})
    expect(() => ga4Transport(destination('public'))).toThrow('unrelated analytics destination')
  })
})
