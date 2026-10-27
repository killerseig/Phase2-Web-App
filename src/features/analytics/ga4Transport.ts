import type { ReadyDestination, UsageEvent, UsageTransport } from './usageAnalytics'
import { safeUsageEvent } from './usageAnalytics'

type Queue = Array<ArrayLike<unknown>>
type AnalyticsWindow = Window & { dataLayer?: Queue; __phase2AnalyticsOwner?: string; gtag?: unknown }
/** Only a configured, approved, consenting controller may construct this transport. */
export function ga4Transport(destination: ReadyDestination): UsageTransport {
  const host = window as AnalyticsWindow
  const owner = destination.scope + ':' + destination.measurementId
  if ((host.__phase2AnalyticsOwner && host.__phase2AnalyticsOwner !== owner) || (!host.__phase2AnalyticsOwner && (host.gtag || host.dataLayer)))
    throw new Error('An unrelated analytics destination is already present.')
  host.__phase2AnalyticsOwner = owner
  const queue = host.dataLayer ??= []
  function tag(...args: unknown[]) {
    void args
    // Preserve Google's documented gtag queue protocol (native Arguments object).
    // https://developers.google.com/tag-platform/gtagjs
    // eslint-disable-next-line prefer-rest-params
    queue.push(arguments)
  }
  const disableKey = 'ga-disable-' + destination.measurementId
  let script: HTMLScriptElement | undefined, stopped = false, initialized = false
  return {
    send(input: UsageEvent) {
      const event = safeUsageEvent(destination.scope, input)
      if (stopped || !event) return
      const screen = event.scope === 'public' ? event.page : event.feature
      const metadata = {
        page_location: destination.origin + '/usage/' + event.scope + '/' + screen,
        page_title: 'Phase 2 ' + event.scope + ' ' + screen,
        page_referrer: '', ignore_referrer: true,
        campaign_source: event.scope === 'public' ? event.campaign.source : 'not_collected',
        campaign_medium: event.scope === 'public' ? event.campaign.medium : 'not_collected',
        campaign_name: event.scope === 'public' ? event.campaign.tagged : 'not_collected',
        campaign_id: '', campaign_term: '', campaign_content: '',
      }
      if (!initialized) {
        Reflect.set(host, disableKey, false)
        tag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
        tag('set', metadata)
        tag('js', new Date())
        tag('config', destination.measurementId, { ...metadata, send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, cookie_prefix: 'phase2_' + destination.scope })
        tag('consent', 'update', { analytics_storage: 'granted' })
        script = document.createElement('script')
        script.async = true
        script.referrerPolicy = 'no-referrer'
        script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(destination.measurementId)
        script.dataset.phase2Analytics = destination.scope
        document.head.append(script)
        initialized = true
      }
      tag('set', metadata)
      tag('event', event.name, { ...metadata, send_to: destination.measurementId,
        ...(event.scope === 'public' ? { page_key: event.page } : { feature_key: event.feature }),
      })
    },
    stop() {
      stopped = true
      Reflect.set(host, disableKey, true)
      queue.length = 0
      script?.remove()
    },
  }
}
