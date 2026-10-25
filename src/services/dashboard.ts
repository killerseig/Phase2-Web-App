export function dashboardError(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  if (/internal|unavailable|not-found/.test(code))
    return 'Dashboard layouts are unavailable. Try again or contact your administrator.'
  return error instanceof Error ? error.message : 'Could not save the dashboard. Please try again.'
}
