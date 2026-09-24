import { createApp, h, nextTick } from 'vue'
import WebsiteCanvas from './components/website/WebsiteCanvas.vue'
import { websiteRuntimeKey } from './features/website/runtimeServices'
import type { WebsiteSite } from './features/website/types'
import './styles/fonts.css'
import 'primeicons/primeicons.css'
let initialized = false
let token = ''
const callbacks = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>()
function send(type: string, values: Record<string, unknown> = {}) {
  parent.postMessage({ ...values, type, token }, '*')
}
window.addEventListener('error', (event) => send('website-error', { message: event.message }))
window.addEventListener('unhandledrejection', (event) =>
  send('website-error', { message: String(event.reason?.message || event.reason) }),
)
window.addEventListener('message', async (event) => {
  if (event.source !== parent || !event.data) return
  const data = event.data
  if (data.type === 'website-form-result' && data.token === token) {
    const callback = callbacks.get(data.requestId)
    if (callback) {
      callbacks.delete(data.requestId)
      if (data.error) callback.reject(new Error(data.error))
      else callback.resolve({ received: true })
    }
    return
  }
  if (data.type !== 'website-init' || initialized) return
  initialized = true
  token = data.token
  const site = data.site as WebsiteSite
  const page = site.pages.find((page) => page.id === data.pageId)
  if (!page) return
  const app = createApp({ render: () => h(WebsiteCanvas, { site, pageId: data.pageId }) })
  app.provide(websiteRuntimeKey, {
    preview: !!data.preview,
    images: data.images,
    submit: (values) =>
      new Promise((resolve, reject) => {
        if (data.preview) {
          reject(new Error('Preview forms cannot submit.'))
          return
        }
        const requestId = crypto.randomUUID()
        callbacks.set(requestId, { resolve, reject })
        send('website-form', { ...values, requestId })
        setTimeout(() => {
          if (callbacks.delete(requestId))
            reject(new Error('The request timed out. Please try again.'))
        }, 95000)
      }),
  })
  app.mount('#website-runtime')
  await nextTick()
  document.addEventListener(
    'click',
    (event) => {
      const link = (event.target as HTMLElement).closest?.('a')
      if (!link) return
      if (data.preview) event.preventDefault()
      else link.target = '_top'
    },
    true,
  )
  for (const [name, source] of [
    ['site', site.js],
    ['page', page.js],
  ] as const) {
    if (!source?.trim()) continue
    const script = document.createElement('script')
    script.textContent = source + '\n//# sourceURL=website-' + name + '.js'
    document.body.appendChild(script)
  }
  new ResizeObserver(() => send('website-height', { height: document.body.scrollHeight })).observe(
    document.body,
  )
})
if (parent !== window) send('website-ready')
