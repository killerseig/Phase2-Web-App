import { describe, expect, it, vi } from 'vitest'
import { createUsageAnalytics, publicCampaign, readyDestination, safeUsageEvent, type AnalyticsScope, type AnalyticsSettings, type ReadyDestination, type TransportFactory, type UsageEvent } from './usageAnalytics'
const settings = (): AnalyticsSettings => ({
  public: { enabled: true, approved: true, measurementId: 'G-PUBLIC1234', hosts: ['phase2.example'] },
  employee: { enabled: true, approved: true, measurementId: 'G-INTERNAL12', hosts: ['phase2.example'] },
})
function fixture(scope: AnalyticsScope = 'public', destination: ReadyDestination | null = readyDestination(settings(), scope, 'https://phase2.example', true)) {
  const send = vi.fn<(event: UsageEvent) => void>(), stop = vi.fn<() => void>()
  const factory = vi.fn<TransportFactory>(() => ({ send, stop }))
  const changed = vi.fn<(value: string) => void>()
  return { send, stop, factory, changed, controller: createUsageAnalytics(destination, factory, changed) }
}
describe('independent disabled-by-default usage analytics', () => {
  it('fails closed for disabled, unapproved, missing, reused, nonproduction or unapproved-host configuration', () => {
    const config = settings()
    config.public.enabled = false
    expect(readyDestination(config, 'public', 'https://phase2.example', true)).toBeNull()
    config.public.enabled = true; config.public.approved = false
    expect(readyDestination(config, 'public', 'https://phase2.example', true)).toBeNull()
    config.public.approved = true; config.public.measurementId = ''
    expect(readyDestination(config, 'public', 'https://phase2.example', true)).toBeNull()
    config.public.measurementId = config.employee.measurementId
    expect(readyDestination(config, 'public', 'https://phase2.example', true)).toBeNull()
    expect(readyDestination(config, 'employee', 'https://phase2.example', true)).toBeNull()
    expect(readyDestination(settings(), 'public', 'https://phase2.example', false)).toBeNull()
    expect(readyDestination(settings(), 'public', 'http://phase2.example', true)).toBeNull()
    expect(readyDestination(settings(), 'public', 'https://other.example', true)).toBeNull()
    const state = fixture('public', null)
    state.controller.view('home'); state.controller.setConsent('granted')
    expect(state.factory).not.toHaveBeenCalled()
  })
  it('sends only the current page after consent, deduplicating refresh/query/hash-equivalent observations', () => {
    const state = fixture()
    state.controller.view('home', '?utm_source=google&utm_medium=cpc&utm_campaign=private-email')
    state.controller.view('services')
    expect(state.factory).not.toHaveBeenCalled()
    state.controller.setConsent('granted')
    state.controller.setConsent('granted'); state.controller.view('services', '?jobId=secret')
    expect(state.send).toHaveBeenCalledOnce()
    expect(state.send).toHaveBeenCalledWith({ scope: 'public', name: 'page_view', page: 'services', campaign: { source: 'search', medium: 'paid', tagged: 'yes' } })
    state.controller.view('home'); expect(state.send).toHaveBeenCalledTimes(2)
    state.controller.setConsent('denied'); state.controller.view('company')
    expect(state.send).toHaveBeenCalledTimes(2)
    expect(state.stop).toHaveBeenCalledOnce()
  })
  it('requires workspace access and fresh consent after logout; internal schemas never use campaigns or route values', () => {
    const state = fixture('employee')
    state.controller.view('job-dashboard', '?utm_source=email&jobId=private')
    state.controller.setConsent('granted')
    expect(state.send).not.toHaveBeenCalled()
    state.controller.setAuthorized(true)
    state.controller.view('job-dashboard', '?jobId=different')
    expect(state.send).toHaveBeenCalledExactlyOnceWith({ scope: 'employee', name: 'feature_view', feature: 'job_dashboard' })
    state.controller.setAuthorized(false)
    state.controller.view('company-library'); state.controller.setAuthorized(true)
    expect(state.send).toHaveBeenCalledOnce()
    state.controller.setConsent('granted')
    expect(state.send).toHaveBeenLastCalledWith({ scope: 'employee', name: 'feature_view', feature: 'library' })
    state.controller.dispose(); state.controller.view('jobs'); state.controller.setConsent('granted')
    expect(state.send).toHaveBeenCalledTimes(2)
  })
  it('never routes employee events to the public destination or public events to employee configuration', () => {
    const marketing = fixture(), internal = fixture('employee')
    marketing.controller.setConsent('granted'); internal.controller.setAuthorized(true); internal.controller.setConsent('granted')
    marketing.controller.view('jobs'); internal.controller.view('home')
    expect(marketing.send).not.toHaveBeenCalled(); expect(internal.send).not.toHaveBeenCalled()
    marketing.controller.view('home'); internal.controller.view('jobs')
    expect(marketing.factory.mock.calls[0]![0].measurementId).toBe('G-PUBLIC1234')
    expect(internal.factory.mock.calls[0]![0].measurementId).toBe('G-INTERNAL12')
  })
  it('drops arbitrary route names, payloads, identifiers and extra fields at runtime', () => {
    const state = fixture('employee'); state.controller.setAuthorized(true); state.controller.setConsent('granted')
    for (const value of ['/jobs/private-id?email=private@example.invalid', 'constructor', { name: 'jobs', userId: 'private-id' }]) state.controller.view(value)
    expect(state.send).not.toHaveBeenCalled()
    expect(safeUsageEvent('employee', { name: 'feature_view', scope: 'employee', feature: 'jobs', userId: 'private-id', values: 'private-answer', url: '/jobs/private-id' })).toEqual({ name: 'feature_view', scope: 'employee', feature: 'jobs' })
    expect(safeUsageEvent('employee', { name: 'feature_view', scope: 'employee', feature: 'private-id' })).toBeNull()
    expect(safeUsageEvent('public', { name: 'feature_view', scope: 'employee', feature: 'jobs' })).toBeNull()
    expect(publicCampaign('?utm_source=private@example.invalid&utm_medium=private&utm_campaign=secret&gclid=secret')).toEqual({ source: 'other', medium: 'other', tagged: 'yes' })
  })
  it('does not break application workflows if the optional provider is blocked', () => {
    const controller = createUsageAnalytics(readyDestination(settings(), 'public', 'https://phase2.example', true), () => { throw new Error('Blocked') })
    controller.view('home')
    expect(() => controller.setConsent('granted')).not.toThrow()
    expect(() => controller.dispose()).not.toThrow()
  })
})
