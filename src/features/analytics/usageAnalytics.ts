export type AnalyticsScope = 'public' | 'employee'
export type Consent = 'unknown' | 'granted' | 'denied'
export interface AnalyticsDestination {
  enabled: boolean
  approved: boolean
  measurementId: string
  hosts: string[]
}
export interface AnalyticsSettings { public: AnalyticsDestination; employee: AnalyticsDestination }
export interface ReadyDestination extends AnalyticsDestination { scope: AnalyticsScope; origin: string }
const publicPages = ['home', 'company', 'services', 'projects', 'safety', 'careers', 'awards', 'location', 'contact'] as const
type PublicPage = typeof publicPages[number]
const employeeRoutes = {
  jobs: 'jobs', dashboard: 'dashboard', 'job-dashboard': 'job_dashboard',
  'personal-workspace': 'personal_dashboard', 'role-workspace': 'role_dashboard',
  'shared-role-home': 'role_dashboard', 'shared-job-home': 'job_dashboard',
  'company-library': 'library', 'sds-library': 'library', reports: 'reports',
  'form-builder': 'form_builder', 'website-builder': 'website_builder',
  'form-response': 'forms', 'form-submission-view': 'form_entries',
  timecards: 'timecards', 'daily-logs': 'daily_logs', 'shop-orders': 'shop_orders',
} as const
type EmployeeFeature = typeof employeeRoutes[keyof typeof employeeRoutes]
export interface Campaign {
  source: 'direct' | 'search' | 'social' | 'email' | 'other'
  medium: 'none' | 'organic' | 'paid' | 'referral' | 'email' | 'social' | 'other'
  tagged: 'yes' | 'no'
}
export type UsageEvent =
  | { name: 'page_view'; scope: 'public'; page: PublicPage; campaign: Campaign }
  | { name: 'feature_view'; scope: 'employee'; feature: EmployeeFeature }
export interface UsageTransport { send(event: UsageEvent): void; stop(): void }
export type TransportFactory = (destination: ReadyDestination) => UsageTransport

/** Runtime allowlist as well as types: extra caller fields can never reach a provider. */
export function safeUsageEvent(scope: AnalyticsScope, input: unknown): UsageEvent | null {
  if (!input || typeof input !== 'object') return null
  const event = input as Record<string, unknown>
  if (event.scope !== scope) return null
  if (scope === 'employee' && event.name === 'feature_view' && Object.values(employeeRoutes).includes(event.feature as EmployeeFeature))
    return { scope, name: 'feature_view', feature: event.feature as EmployeeFeature }
  if (scope !== 'public' || event.name !== 'page_view' || !publicPages.includes(event.page as PublicPage) || !event.campaign || typeof event.campaign !== 'object') return null
  const campaign = event.campaign as Record<string, unknown>
  if (typeof campaign.source !== 'string' || typeof campaign.medium !== 'string' || typeof campaign.tagged !== 'string' ||
    !['direct', 'search', 'social', 'email', 'other'].includes(campaign.source) ||
    !['none', 'organic', 'paid', 'referral', 'email', 'social', 'other'].includes(campaign.medium) || !['yes', 'no'].includes(campaign.tagged)) return null
  return { scope, name: 'page_view', page: event.page as PublicPage, campaign: { source: campaign.source as Campaign['source'], medium: campaign.medium as Campaign['medium'], tagged: campaign.tagged as Campaign['tagged'] } }
}

/** No arbitrary query values leave this boundary; campaign names/content/terms are never retained. */
export function publicCampaign(search: string): Campaign {
  const query = new URLSearchParams(search)
  const source = query.get('utm_source')?.toLowerCase()
  const medium = query.get('utm_medium')?.toLowerCase()
  return {
    source: !source ? 'direct' : ['google', 'bing', 'duckduckgo'].includes(source) ? 'search' :
      ['linkedin', 'facebook', 'instagram'].includes(source) ? 'social' : ['email', 'newsletter'].includes(source) ? 'email' : 'other',
    medium: !medium ? 'none' : medium === 'organic' ? 'organic' : ['cpc', 'ppc', 'paid'].includes(medium) ? 'paid' :
      ['referral', 'email', 'social'].includes(medium) ? medium as 'referral' | 'email' | 'social' : 'other',
    tagged: ['utm_source', 'utm_medium', 'utm_campaign'].some(key => query.has(key)) ? 'yes' : 'no',
  }
}
export function readyDestination(settings: AnalyticsSettings, scope: AnalyticsScope, origin: string, production: boolean): ReadyDestination | null {
  const destination = settings[scope], other = settings[scope === 'public' ? 'employee' : 'public']
  let url: URL
  try { url = new URL(origin) } catch { return null }
  if (!production || !destination.enabled || !destination.approved || !/^G-[A-Z0-9]{6,}$/.test(destination.measurementId) ||
    destination.measurementId === other.measurementId || url.protocol !== 'https:' ||
    !destination.hosts.includes(url.hostname) || ['localhost', '127.0.0.1'].includes(url.hostname)) return null
  return { ...destination, scope, origin: url.origin }
}

export function createUsageAnalytics(destination: ReadyDestination | null, factory: TransportFactory, onConsent: (value: Consent) => void = () => {}) {
  let consent: Consent = 'unknown', authorized = destination?.scope === 'public', disposed = false
  let current: UsageEvent | null = null, sent = '', transport: UsageTransport | undefined
  let campaign: Campaign | undefined
  const stop = () => {
    try { transport?.stop() } catch { /* Optional telemetry teardown cannot break navigation. */ }
    transport = undefined; sent = ''
  }
  function flush() {
    if (!destination || disposed || !authorized || consent !== 'granted' || !current) return
    const key = JSON.stringify(current)
    if (sent === key) return
    try {
      transport ??= factory(destination)
      transport.send(current)
      sent = key
    } catch { stop() } // Optional telemetry cannot block navigation or business workflows.
  }
  function view(value: unknown, campaignSearch = '') {
    if (!destination || disposed) return
    if (destination.scope === 'public') {
      campaign ??= publicCampaign(campaignSearch)
      current = typeof value === 'string' && publicPages.includes(value as PublicPage)
        ? { name: 'page_view', scope: 'public', page: value as PublicPage, campaign } : null
    } else {
      const feature = typeof value === 'string' && Object.hasOwn(employeeRoutes, value) ? employeeRoutes[value as keyof typeof employeeRoutes] : undefined
      current = feature ? { name: 'feature_view', scope: 'employee', feature } : null
    }
    if (!current) stop()
    flush()
  }
  return {
    available: !!destination,
    view,
    setConsent(value: Consent) {
      if (disposed || !destination || value === consent) return
      consent = value; onConsent(value)
      if (value !== 'granted') stop()
      else flush()
    },
    setAuthorized(value: boolean) {
      if (value === authorized) return
      authorized = value
      if (!value) {
        current = null; stop()
        if (destination?.scope === 'employee') { consent = 'unknown'; onConsent(consent) }
      } else flush()
    },
    dispose() { disposed = true; current = null; stop() },
  }
}
export type UsageAnalytics = ReturnType<typeof createUsageAnalytics>
