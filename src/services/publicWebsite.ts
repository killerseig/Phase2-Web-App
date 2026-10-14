import { embeddedPublicSnapshot, type PublicSnapshot } from '@/features/website/publicSnapshot'
const lifetime = 30000
let cached: PublicSnapshot | null = null, checkedAt = 0, pending: Promise<PublicSnapshot> | undefined, generation = 0
export function clearPublicSnapshotCache() { generation++; cached = null; checkedAt = 0; pending = undefined }
export function initialPublicSnapshot() {
  const embedded = embeddedPublicSnapshot()
  if (embedded) { cached = embedded; checkedAt = Date.now() }
  return embedded
}
function endpoint() {
  const local = (import.meta.env.DEV || import.meta.env.MODE === 'performance-test') && import.meta.env.VITE_PUBLIC_SNAPSHOT_URL
  if (local) {
    const url = new URL(local)
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Local public snapshot endpoint must be loopback.')
    return url.href
  }
  const project = import.meta.env.VITE_FIREBASE_PROJECT_ID
  if (!/^[a-z][a-z0-9-]{4,62}$/.test(project || '')) throw new Error('Configure the published website project.')
  return `https://us-central1-${project}.cloudfunctions.net/getPublishedWebsite`
}
export function loadPublicSnapshot(force = false): Promise<PublicSnapshot> {
  if (!force && cached && Date.now() - checkedAt < lifetime) return Promise.resolve(cached)
  if (pending) return pending
  const startedGeneration = generation
  const task = (async () => {
    const url = new URL(endpoint()); url.searchParams.set('format', 'json')
    let response = await fetch(url, { credentials: 'omit', cache: 'no-cache', headers: cached?.version ? { 'If-None-Match': '"' + cached.version + '"' } : {}, signal: AbortSignal.timeout(20000) })
    // Old deployments still use the callable POST protocol. Keep staged rollout compatible.
    if (response.status === 400 || response.status === 405) response = await fetch(endpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', body: JSON.stringify({ data: {} }), signal: AbortSignal.timeout(20000) })
    if (generation !== startedGeneration) throw new Error('Published snapshot read was superseded.')
    if (response.status === 304 && cached) { checkedAt = Date.now(); return cached }
    if (!response.ok) throw new Error('The website service is unavailable.')
    const body = await response.json(), value = body.result ?? body.data
    if (generation !== startedGeneration) throw new Error('Published snapshot read was superseded.')
    if (!value || !Object.prototype.hasOwnProperty.call(value, 'site') || (value.site !== null && !Array.isArray(value.site?.pages))) throw new Error('Invalid published website response.')
    cached = { site: value.site, version: typeof value.version === 'string' ? value.version : null }
    checkedAt = Date.now()
    return cached
  })().finally(() => { if (pending === task) pending = undefined })
  pending = task
  return task
}
