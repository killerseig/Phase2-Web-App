import { computed, getCurrentScope, onScopeDispose, readonly, ref, watch, type Ref } from 'vue'
import { captureWebsiteWidgets, planWebsitePaste, type WebsiteWidgetClipboard } from './widgetClipboard'
import { isFlow } from './responsive'
import { descendants, visibleSections } from './containers'
import type { WebsitePage, WebsiteSite } from './types'

interface Confirmation {
  title: string
  message: string
  confirmLabel: string
  destructive: boolean
}

export function useWebsiteSelectionCommands(options: {
  identity: Readonly<Ref<string>>
  enabled: Readonly<Ref<boolean>>
  site: Ref<WebsiteSite | undefined>
  page: Readonly<Ref<WebsitePage | undefined>>
  selectedIds: Ref<string[]>
  mode: Readonly<Ref<string>>
  context: () => string
  environment: () => unknown
  blocked: () => boolean
  interacting: () => boolean
  confirm: (request: Confirmation, trigger?: Event) => Promise<boolean | undefined> | undefined
  cancelConfirmation: () => void
  change: (operation: () => void) => void
  travel: (direction: 'undo' | 'redo') => void
  select: (ids: string[]) => void
  report: (message: string, error?: boolean) => void
  invalidate?: () => void
  completed?: (action: string) => void
  visible?: () => string[]
}) {
  const clipboard = ref<WebsiteWidgetClipboard>()
  const pending = ref(false)
  const disposed = ref(false)
  const allowed = computed(() => !disposed.value && !!options.identity.value && options.enabled.value)
  let revision = 0, attempt = 0

  function invalidate() {
    revision++
    attempt++
    if (pending.value) {
      pending.value = false
      options.cancelConfirmation()
    }
    options.invalidate?.()
  }
  const stopIdentity = watch([options.identity, options.enabled], () => {
    clipboard.value = undefined
    invalidate()
  }, { flush: 'sync' })
  const stopContext = watch(
    [options.page, options.mode, () => options.selectedIds.value.join('\0')],
    invalidate,
    { flush: 'sync' },
  )
  // Keep this getter in its own effect: callers may return a new tuple. An equivalent
  // selection cleanup must not reevaluate that tuple and revoke post-command focus.
  const stopEnvironment = watch(options.environment, invalidate, { flush: 'sync' })
  // An edit followed by Undo, or a reload with the same IDs, still revokes a pending decision.
  const stopDraft = watch(options.site, invalidate, { deep: true, flush: 'sync' })
  function capture() {
    const owner = revision
    return () => allowed.value && owner === revision
  }
  function ready() {
    return allowed.value && options.mode.value === 'design' && !!options.page.value &&
      !options.blocked() && !options.interacting() && !pending.value
  }
  function selection() {
    return captureWebsiteWidgets(options.page.value?.sections || [], options.selectedIds.value, options.context())
  }
  function available(action: string) {
    // A pointer-down on an action button must not disable that same button before click.
    if (!allowed.value || options.mode.value !== 'design' || !options.page.value || options.blocked() || pending.value) return false
    if (action === 'all' || action === 'undo' || action === 'redo') return true
    const sections = action === 'paste' ? clipboard.value?.sections :
      descendants(options.page.value.sections, options.selectedIds.value)
    if (!sections?.length) return false
    if (sections.some(section => section.type === 'page-content')) return false
    return !['paste', 'duplicate'].includes(action) ||
      sections.length + options.page.value.sections.length <= 30
  }
  function hasModal() {
    return typeof document !== 'undefined' && !!document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')
  }
  async function run(action: string, trigger?: Event, point?: { x: number; y: number }) {
    if (!ready() || hasModal()) return false
    const target = options.page.value!
    if (action === 'all') {
      options.select(options.visible?.() || visibleSections(target.sections).map(section => section.id))
      return true
    }
    if (action === 'undo' || action === 'redo') {
      options.travel(action)
      return true
    }
    if (!['copy', 'paste', 'duplicate', 'cut', 'delete'].includes(action)) return false
    const source = action === 'paste' ? clipboard.value : selection()
    if (!source) return false
    if (source.sections.some(section => section.type === 'page-content')) {
      options.report('Keep the page-content slot in the site layout.', true)
      return false
    }
    if (action === 'copy') {
      clipboard.value = source
      options.report(`${source.sections.length} widget(s) copied in this editor.`)
      return true
    }
    if (action === 'paste' || action === 'duplicate') {
      const grid = target.grid
      const result = planWebsitePaste(source, target.sections, {
        context: options.context(), point,
        positioned: target !== options.site.value?.sharedLayout && !isFlow(target.layout, 'desktop'),
        spacing: { x: grid?.spacingX || 1, y: grid?.spacingY || 1 },
        formIds: options.site.value?.forms?.map(form => form.id) || [],
        widgetIds: options.site.value?.customWidgets?.map(widget => widget.id) || [],
      })
      if (!result.ok) {
        options.report(result.error, true)
        return false
      }
      options.change(() => {
        for (const section of target.sections)
          if (result.layouts?.[section.id]) section.layout = result.layouts[section.id]
        target.sections.push(...result.sections)
      })
      options.select(result.roots)
      options.report(`${result.sections.length} widget(s) ${action === 'paste' ? 'pasted' : 'duplicated'}.`)
      options.completed?.(action)
      return true
    }
    const current = capture()
    const owner = ++attempt
    const ids = new Set(source.sections.map(section => section.id))
    pending.value = true
    try {
      const accepted = await options.confirm({
        title: action === 'cut' ? 'Cut widgets?' : 'Remove widgets?',
        message: `${action === 'cut' ? 'Cut' : 'Remove'} ${ids.size} widget(s), including container contents, from this draft? You can undo this change.`,
        confirmLabel: action === 'cut' ? 'Cut widgets' : 'Remove widgets',
        destructive: true,
      }, trigger)
      if (!accepted || owner !== attempt || !current() || options.blocked() || options.interacting()) return false
      // The snapshot and selection epochs above cover descendants added/reparented while confirming.
      options.change(() => { target.sections = target.sections.filter(section => !ids.has(section.id)) })
      if (action === 'cut') clipboard.value = source
      options.select([])
      options.report(action === 'cut' ? `${ids.size} widget(s) cut. Paste them within this editor.` : 'Widgets removed. You can undo this change.')
      options.completed?.(action)
      return true
    } catch {
      if (owner === attempt && current()) options.report('The confirmation could not complete. Try again.', true)
      return false
    } finally {
      if (owner === attempt) pending.value = false
    }
  }
  function key(event: KeyboardEvent) {
    const target = event.target
    if (!allowed.value || options.mode.value !== 'design' || event.defaultPrevented || event.isComposing || event.altKey ||
      !(target instanceof HTMLElement) || !target.closest('[data-website-selection-commands]') ||
      target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), dialog, [role="dialog"], [role="menu"], [role="tablist"]')) return
    const command = event.ctrlKey !== event.metaKey
    const letter = event.key.toLowerCase()
    let action: string | undefined
    if (command) {
      if (letter === 'z') action = event.shiftKey ? 'redo' : 'undo'
      else if (!event.shiftKey) action = ({ a: 'all', c: 'copy', v: 'paste', x: 'cut', d: 'duplicate', y: 'redo' } as Record<string, string>)[letter]
    } else if (!event.ctrlKey && !event.metaKey && !event.shiftKey && ['Delete', 'Backspace'].includes(event.key)) action = 'delete'
    if (!action) return
    event.preventDefault()
    if (!event.repeat) void run(action, event)
  }
  function dispose() {
    if (disposed.value) return
    disposed.value = true
    clipboard.value = undefined
    invalidate()
    stopIdentity(); stopContext(); stopEnvironment(); stopDraft()
  }
  if (getCurrentScope()) onScopeDispose(dispose)
  return { clipboard: readonly(clipboard), pending: readonly(pending), available, ready, run, key, capture, dispose }
}
