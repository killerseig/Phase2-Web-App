import { onBeforeUnmount, onMounted, ref, type InjectionKey } from 'vue'
import { createUsageAnalytics, readyDestination, type AnalyticsScope, type Consent, type UsageAnalytics } from './usageAnalytics'
import { ga4Transport } from './ga4Transport'

export const publicUsageKey: InjectionKey<UsageAnalytics> = Symbol('public-usage-analytics')
export function useUsageAnalytics(scope: AnalyticsScope) {
  const choice = ref<Consent>('unknown')
  const hosts = (value?: string) => (value || '').split(',').map(host => host.trim()).filter(Boolean)
  const settings = {
    public: { enabled: import.meta.env.VITE_PUBLIC_ANALYTICS_ENABLED === 'true', approved: import.meta.env.VITE_PUBLIC_ANALYTICS_APPROVED === 'true', measurementId: import.meta.env.VITE_PUBLIC_GA4_MEASUREMENT_ID || '', hosts: hosts(import.meta.env.VITE_PUBLIC_ANALYTICS_HOSTS) },
    employee: { enabled: import.meta.env.VITE_EMPLOYEE_ANALYTICS_ENABLED === 'true', approved: import.meta.env.VITE_EMPLOYEE_ANALYTICS_APPROVED === 'true', measurementId: import.meta.env.VITE_EMPLOYEE_GA4_MEASUREMENT_ID || '', hosts: hosts(import.meta.env.VITE_EMPLOYEE_ANALYTICS_HOSTS) },
  }
  const destination = typeof window === 'undefined' ? null : readyDestination(settings, scope, window.location.origin, import.meta.env.PROD)
  let mounted = false
  const controller = createUsageAnalytics(destination, config => ga4Transport(config), value => { choice.value = value })
  onMounted(() => { mounted = true })
  onBeforeUnmount(() => { mounted = false; controller.dispose() })
  return { controller, choice, setConsent(value: Consent) { if (mounted) controller.setConsent(value) } }
}
