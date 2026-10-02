// Lightweight GA4 event helper for Highway Speedster.
// Never sends usernames, account IDs, emails, or other personal data.
const GA_MEASUREMENT_ID = 'G-PN61M3D29R'

type AnalyticsValue = string | number | boolean
type AnalyticsParams = Record<string, AnalyticsValue>

function getGtag(): ((...args: unknown[]) => void) | null {
  if (typeof window === 'undefined') return null
  const candidate = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag
  return typeof candidate === 'function' ? candidate : null
}

export function trackEvent(name: string, params: AnalyticsParams = {}) {
  const gtag = getGtag()
  if (!gtag) return

  gtag('event', name, {
    ...params,
    analytics_version: 1,
    send_to: GA_MEASUREMENT_ID,
  })
}

export function setAnalyticsUserProperty(name: string, value: string | number | boolean) {
  const gtag = getGtag()
  if (!gtag) return

  gtag('set', 'user_properties', { [name]: value })
}
