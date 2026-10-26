import { nextTick, type Ref } from 'vue'
import { websiteCommand, websiteError } from '@/services/website'
import { withWebsiteDefaults, type WebsiteSite } from './types'
import type { useWebsiteAutosave } from './useWebsiteAutosave'
import type { useWebsiteHistory } from './useWebsiteHistory'

export interface WebsiteCommandConfirmation {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
}

export function useWebsiteCommands(options: {
  site: Ref<WebsiteSite | undefined>
  locked: Readonly<Ref<boolean>>
  dirty: Readonly<Ref<boolean>>
  cssError: Readonly<Ref<string>>
  publishBlocked: Readonly<Ref<boolean>>
  loading: Ref<boolean>
  busy: Ref<boolean>
  saving: Ref<boolean>
  error: Ref<string>
  message: Ref<string>
  saved: Ref<string>
  version: Ref<number>
  starterReview: Ref<boolean>
  publishedAt: Ref<number | null>
  hasPrevious: Ref<boolean>
  homePageId: Ref<string>
  selectedPage: Ref<string>
  selectedSection: Ref<string>
  history: Pick<ReturnType<typeof useWebsiteHistory>, 'checkpoint' | 'reset'>
  autosave: Pick<
    ReturnType<typeof useWebsiteAutosave>,
    | 'stash'
    | 'ready'
    | 'settle'
    | 'conflict'
    | 'problem'
    | 'discover'
    | 'begin'
    | 'online'
    | 'persist'
    | 'protectedLocally'
    | 'reportFailure'
  >
  canDiscard: (trigger?: Event) => Promise<boolean>
  confirm: (request: WebsiteCommandConfirmation, trigger?: Event) => Promise<boolean> | undefined
  onLoaded: (version: number) => void
  onRestored: (version: number) => void
  fitView: () => void
}) {
  const {
    site,
    locked,
    dirty,
    cssError,
    publishBlocked,
    loading,
    busy,
    saving,
    error,
    message,
    saved,
    version,
    starterReview,
    publishedAt,
    hasPrevious,
    homePageId,
    selectedPage,
    selectedSection,
    history,
    autosave,
  } = options
  const fitView = options.fitView
  async function load(trigger?: Event) {
    if (!(await options.canDiscard(trigger))) return
    autosave.stash()
    autosave.ready.value = false
    loading.value = true
    error.value = ''
    message.value = ''
    let receivedDraft = false
    try {
      await autosave.settle()
      const result = await websiteCommand('load')
      history.reset(withWebsiteDefaults(result.draft))
      starterReview.value = false
      options.onLoaded(result.version)
      version.value = result.version
      saved.value = JSON.stringify(result.draft)
      receivedDraft = true
      autosave.conflict.value = false
      autosave.problem.value = ''
      autosave.discover(saved.value)
      if (dirty.value)
        message.value =
          'This draft is ready for the grid editor. Review the layout and save it before publishing.'
      publishedAt.value = result.publishedAt
      hasPrevious.value = result.hasPrevious
      homePageId.value = result.draft.pages.find((page) => page.slug === 'home')?.id || ''
      selectedPage.value = result.draft.pages[0]?.id || ''
      selectedSection.value = ''
      await nextTick()
      fitView()
    } catch (reason) {
      error.value = websiteError(reason)
    } finally {
      loading.value = false
      if (site.value) autosave.begin(!receivedDraft)
    }
  }
  async function command(
    action: 'save' | 'publish' | 'restore' | 'unpublish' | 'restoreRevision',
    revisionId?: string,
    trigger?: Event,
  ) {
    if (locked.value || !site.value) return
    if ((action === 'save' || action === 'publish') && cssError.value) {
      error.value = cssError.value
      return
    }
    if (action === 'save' && !autosave.online.value) {
      autosave.persist()
      message.value = autosave.protectedLocally.value
        ? 'Saved in this browser. Your draft will sync when the connection returns.'
        : ''
      return
    }
    if (
      action === 'publish' &&
      !(await options.confirm(
        {
          title: 'Publish website?',
          message: 'Your saved pages and images will be visible to anyone with the website link.',
          confirmLabel: 'Publish website',
        },
        trigger,
      ))
    )
      return
    if (
      action === 'unpublish' &&
      !(await options.confirm(
        {
          title: 'Take website offline?',
          message:
            'Visitors will no longer see the published website. Your saved draft will remain available.',
          confirmLabel: 'Take offline',
          destructive: true,
        },
        trigger,
      ))
    )
      return
    if (
      (action === 'restore' || action === 'restoreRevision') &&
      !(await options.canDiscard(trigger))
    )
      return
    if (locked.value || !site.value) return
    if (action === 'publish' && publishBlocked.value) {
      error.value = 'Resolve the publishing checks before publishing.'
      return
    }
    history.checkpoint()
    busy.value = true
    saving.value = action === 'save'
    error.value = ''
    message.value = ''
    try {
      await autosave.settle()
      const snapshot = JSON.stringify(site.value)
      const result = await websiteCommand(action, {
        version: version.value,
        ...(action === 'save' ? { site: JSON.parse(snapshot) } : {}),
        ...(action === 'restoreRevision' ? { revisionId } : {}),
      })
      version.value = result.version
      if (action === 'save') {
        starterReview.value = false
        saved.value = snapshot
        autosave.problem.value = ''
        autosave.conflict.value = false
      }
      if (result.draft) {
        history.reset(withWebsiteDefaults(result.draft))
        options.onRestored(result.version)
        saved.value = JSON.stringify(result.draft)
        homePageId.value = result.draft.pages.find((page) => page.slug === 'home')?.id || ''
        selectedPage.value = result.draft.pages[0]?.id || ''
        selectedSection.value = ''
      }
      if (result.publishedAt !== undefined) publishedAt.value = result.publishedAt
      if (result.hasPrevious !== undefined) hasPrevious.value = result.hasPrevious
      autosave.persist()
      message.value = {
        save: 'Draft saved. The published website has not changed.',
        publish: 'Website published.',
        restore: 'Previous published version restored to your draft. Review it before publishing.',
        unpublish: 'Website taken offline. Your draft is retained.',
        restoreRevision: 'Saved version restored to your draft. Review it before publishing.',
      }[action]
    } catch (reason) {
      error.value = websiteError(reason)
      if (action === 'save') autosave.reportFailure(reason)
    } finally {
      busy.value = false
      saving.value = false
    }
  }
  return { load, command }
}
