import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, ref, watch } from 'vue'
import { newSection, type WebsitePage, type WebsiteSection, type WebsiteSite } from './types'
import { useWebsiteHistory } from './useWebsiteHistory'
import { useWebsiteSelectionCommands } from './useWebsiteSelectionCommands'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}

function widget(id: string, extra: Partial<WebsiteSection> = {}): WebsiteSection {
  return {
    ...newSection('text'),
    id,
    title: id,
    layout: { x: 2, y: 3, w: 4, h: 4, z: 1 },
    ...extra,
  }
}

function makePage(id: string, sections: WebsiteSection[]): WebsitePage {
  return { id, title: id, slug: id, description: '', inNavigation: true, sections }
}

const cleanups: (() => void)[] = []
afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach((cleanup) => cleanup())
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

function setup(
  sections = [widget('a'), widget('b', { layout: { x: 8, y: 3, w: 4, h: 4, z: 2 } })],
) {
  const scope = effectScope()
  cleanups.push(() => scope.stop())
  const site = ref<WebsiteSite>()
  const identity = ref('admin-a')
  const enabled = ref(true)
  const mode = ref('design')
  const selectedIds = ref([sections[0]!.id])
  const pageId = ref('home')
  const editingLayout = ref(false)
  const device = ref('desktop')
  const busy = ref(false)
  const interacting = ref(false)
  const page = computed(() =>
    editingLayout.value
      ? site.value?.sharedLayout
      : site.value?.pages.find((entry) => entry.id === pageId.value),
  )
  const history = scope.run(() => useWebsiteHistory(site))!
  history.reset({
    name: 'Test website',
    accent: '#174878',
    pages: [makePage('home', sections), makePage('other', [])],
    sharedLayout: makePage('layout', [widget('slot', { type: 'page-content', locked: true })]),
  })
  const confirmations: ReturnType<typeof deferred<boolean | undefined>>[] = []
  type Options = Parameters<typeof useWebsiteSelectionCommands>[0]
  const confirm = vi.fn<Options['confirm']>(() => {
    const request = deferred<boolean | undefined>()
    confirmations.push(request)
    return request.promise
  })
  const cancelConfirmation = vi.fn<Options['cancelConfirmation']>()
  const change = vi.fn<Options['change']>((operation) => history.change(operation))
  const travel = vi.fn<Options['travel']>((direction) => history[direction]())
  const select = vi.fn<Options['select']>((ids) => {
    selectedIds.value = ids
  })
  const report = vi.fn<Options['report']>()
  const invalidate = vi.fn<NonNullable<Options['invalidate']>>()
  const completed = vi.fn<NonNullable<Options['completed']>>()
  const commands = scope.run(() =>
    useWebsiteSelectionCommands({
      identity,
      enabled,
      site,
      page,
      selectedIds,
      mode,
      context: () => `${editingLayout.value ? 'layout' : 'page'}:${page.value?.id || ''}`,
      environment: () => [
        pageId.value,
        editingLayout.value,
        device.value,
        busy.value,
        interacting.value,
      ],
      blocked: () => busy.value,
      interacting: () => interacting.value,
      confirm,
      cancelConfirmation,
      change,
      travel,
      select,
      report,
      invalidate,
      completed,
    }),
  )!
  return {
    commands,
    scope,
    site,
    page,
    identity,
    enabled,
    mode,
    selectedIds,
    pageId,
    editingLayout,
    device,
    busy,
    interacting,
    history,
    confirmations,
    confirm,
    cancelConfirmation,
    change,
    travel,
    select,
    report,
    invalidate,
    completed,
  }
}

type Fixture = ReturnType<typeof setup>
function state(fixture: Fixture) {
  return JSON.stringify(fixture.site.value)
}
function clipboardState(fixture: Fixture) {
  return JSON.stringify(fixture.commands.clipboard.value)
}
function keyboard(
  fixture: Fixture,
  markup = '<section data-website-selection-commands><button>Widget</button></section>',
) {
  const host = document.createElement('div')
  host.innerHTML = markup
  host.addEventListener('keydown', fixture.commands.key)
  document.body.append(host)
  return {
    host,
    press(target: Element, key: string, options: KeyboardEventInit = {}, prevented = false) {
      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key,
        ...options,
      })
      if (prevented) event.preventDefault()
      target.dispatchEvent(event)
      return event
    },
  }
}

describe('website selection commands', () => {
  it('copies an independent subtree and commits each paste as one undoable change', async () => {
    const fixture = setup([
      widget('group', { type: 'container', container: { direction: 'column', gap: 16 } }),
      widget('child', { parentId: 'group', text: 'Original text' }),
      widget('other'),
    ])
    fixture.selectedIds.value = ['group', 'child']
    const before = state(fixture)
    expect(await fixture.commands.run('copy')).toBe(true)
    const copied = clipboardState(fixture)
    expect(fixture.change).not.toHaveBeenCalled()
    expect(fixture.history.canUndo.value).toBe(false)

    expect(await fixture.commands.run('paste')).toBe(true)
    const originals = new Set(['group', 'child', 'other'])
    const additions = fixture.page.value!.sections.filter((entry) => !originals.has(entry.id))
    const container = additions.find((entry) => entry.type === 'container')!
    const child = additions.find((entry) => entry.type === 'text')!
    expect(additions).toHaveLength(2)
    expect(child.parentId).toBe(container.id)
    expect(child.text).toBe('Original text')
    expect(fixture.selectedIds.value).toEqual([container.id])
    expect(fixture.change).toHaveBeenCalledTimes(1)
    expect(clipboardState(fixture)).toBe(copied)
    expect(await fixture.commands.run('undo')).toBe(true)
    expect(state(fixture)).toBe(before)
    expect(fixture.history.canUndo.value).toBe(false)
    expect(await fixture.commands.run('redo')).toBe(true)
    expect(fixture.page.value!.sections).toHaveLength(5)
  })

  it('retains a copy across page and device changes without linking its content to the source', async () => {
    const fixture = setup()
    expect(await fixture.commands.run('copy')).toBe(true)
    fixture.page.value!.sections[0]!.text = 'Changed after copying'
    fixture.pageId.value = 'other'
    fixture.device.value = 'mobile'
    fixture.mode.value = 'content'
    fixture.mode.value = 'design'
    fixture.selectedIds.value = []
    expect(fixture.commands.clipboard.value).toBeDefined()
    expect(await fixture.commands.run('paste')).toBe(true)
    expect(fixture.page.value!.sections).toHaveLength(1)
    expect(fixture.page.value!.sections[0]!.text).toBe('')
    expect(fixture.page.value!.sections[0]!.parentId).toBeUndefined()
  })

  it('keeps the existing clipboard until Cut is confirmed, and preserves it when cancelled', async () => {
    const fixture = setup()
    await fixture.commands.run('copy')
    const copied = clipboardState(fixture)
    const before = state(fixture)
    fixture.selectedIds.value = ['b']
    const result = fixture.commands.run('cut')
    expect(fixture.commands.pending.value).toBe(true)
    expect(clipboardState(fixture)).toBe(copied)
    expect(state(fixture)).toBe(before)
    fixture.confirmations[0]!.resolve(false)
    expect(await result).toBe(false)
    expect(fixture.commands.pending.value).toBe(false)
    expect(clipboardState(fixture)).toBe(copied)
    expect(state(fixture)).toBe(before)
    expect(fixture.change).not.toHaveBeenCalled()
  })

  it('cuts the complete subtree atomically and preserves layout locks on paste', async () => {
    const fixture = setup([
      widget('group', {
        type: 'container',
        locked: true,
        container: { direction: 'column', gap: 16 },
      }),
      widget('child', { parentId: 'group' }),
      widget('other'),
    ])
    const before = state(fixture)
    expect(fixture.commands.available('cut')).toBe(true)
    const cut = fixture.commands.run('cut')
    fixture.confirmations[0]!.resolve(true)
    expect(await cut).toBe(true)
    expect(fixture.page.value!.sections.map((entry) => entry.id)).toEqual(['other'])
    expect(fixture.selectedIds.value).toEqual([])
    expect(fixture.change).toHaveBeenCalledTimes(1)
    expect(await fixture.commands.run('undo')).toBe(true)
    expect(state(fixture)).toBe(before)
    expect(await fixture.commands.run('paste')).toBe(true)
    const added = fixture.page.value!.sections.filter(
      (entry) => !['group', 'child', 'other'].includes(entry.id),
    )
    expect(added).toHaveLength(2)
    const copiedContainer = added.find((entry) => entry.type === 'container')!
    expect(copiedContainer.locked).toBe(true)
    expect(added.find((entry) => entry.type === 'text')!.parentId).toBe(copiedContainer.id)
  })

  it.each(['copy', 'duplicate', 'cut', 'delete'] as const)(
    'rejects %s of the required page-content slot without changing clipboard or history',
    async (action) => {
      const fixture = setup()
      await fixture.commands.run('copy')
      const copied = clipboardState(fixture)
      fixture.editingLayout.value = true
      fixture.selectedIds.value = ['slot']
      const before = state(fixture)
      expect(fixture.commands.available(action)).toBe(false)
      expect(await fixture.commands.run(action)).toBe(false)
      expect(fixture.confirm).not.toHaveBeenCalled()
      expect(state(fixture)).toBe(before)
      expect(clipboardState(fixture)).toBe(copied)
      expect(fixture.change).not.toHaveBeenCalled()
    },
  )

  it('rejects an over-limit paste without partial insertion or losing the clipboard', async () => {
    const fixture = setup(Array.from({ length: 30 }, (_, index) => widget(`widget-${index}`)))
    await fixture.commands.run('copy')
    const before = state(fixture)
    const copied = clipboardState(fixture)
    expect(fixture.commands.available('paste')).toBe(false)
    expect(await fixture.commands.run('paste')).toBe(false)
    expect(state(fixture)).toBe(before)
    expect(clipboardState(fixture)).toBe(copied)
    expect(fixture.change).not.toHaveBeenCalled()
    expect(fixture.history.canUndo.value).toBe(false)
  })

  it('falls back safely from a non-finite paste anchor without changing the clipboard', async () => {
    const fixture = setup()
    await fixture.commands.run('copy')
    const copied = clipboardState(fixture)
    expect(await fixture.commands.run('paste', undefined, { x: Number.NaN, y: 1 })).toBe(true)
    expect(fixture.page.value!.sections).toHaveLength(3)
    const pasted = fixture.page.value!.sections[2]!.layout!
    expect(Object.values(pasted).every(Number.isFinite)).toBe(true)
    expect(clipboardState(fixture)).toBe(copied)
    expect(fixture.change).toHaveBeenCalledTimes(1)
  })

  it('rejects layer exhaustion without renumbering a locked sibling or partially pasting', async () => {
    const fixture = setup([
      widget('a'),
      widget('locked', { locked: true, layout: { x: 8, y: 3, w: 4, h: 4, z: 10000 } }),
    ])
    await fixture.commands.run('copy')
    const before = state(fixture)
    const copied = clipboardState(fixture)
    expect(await fixture.commands.run('paste')).toBe(false)
    expect(state(fixture)).toBe(before)
    expect(clipboardState(fixture)).toBe(copied)
    expect(fixture.change).not.toHaveBeenCalled()
    expect(fixture.history.canUndo.value).toBe(false)
  })

  it('preserves a valid clipboard when a later copy has an empty selection', async () => {
    const fixture = setup()
    await fixture.commands.run('copy')
    const copied = clipboardState(fixture)
    fixture.selectedIds.value = []
    expect(await fixture.commands.run('copy')).toBe(false)
    expect(clipboardState(fixture)).toBe(copied)
    expect(fixture.change).not.toHaveBeenCalled()
  })

  it('permits duplication of a layout-locked object and retains its lock', async () => {
    const fixture = setup([widget('locked', { locked: true })])
    expect(fixture.commands.available('duplicate')).toBe(true)
    expect(await fixture.commands.run('duplicate')).toBe(true)
    expect(fixture.page.value!.sections).toHaveLength(2)
    expect(fixture.page.value!.sections[1]!.locked).toBe(true)
    expect(fixture.page.value!.sections[0]!.id).toBe('locked')
    expect(fixture.change).toHaveBeenCalledTimes(1)
  })

  it('selects only effectively visible widgets, excluding hidden container descendants', async () => {
    const fixture = setup([
      widget('hidden', { type: 'container', hidden: true }),
      widget('hidden-child', { parentId: 'hidden' }),
      widget('visible'),
    ])
    expect(await fixture.commands.run('all')).toBe(true)
    expect(fixture.selectedIds.value).toEqual(['visible'])
    expect(fixture.change).not.toHaveBeenCalled()
  })
})

describe('website command lifetime', () => {
  it('preserves context and pending confirmation when selection is replaced with the same IDs', async () => {
    const fixture = setup()
    const current = fixture.commands.capture()
    const removal = fixture.commands.run('delete')
    fixture.selectedIds.value = [...fixture.selectedIds.value]
    expect(current()).toBe(true)
    expect(fixture.commands.pending.value).toBe(true)
    expect(fixture.cancelConfirmation).not.toHaveBeenCalled()
    expect(fixture.invalidate).not.toHaveBeenCalled()
    fixture.confirmations[0]!.resolve(false)
    expect(await removal).toBe(false)
    expect(fixture.change).not.toHaveBeenCalled()
  })

  it('keeps completed Cut focus valid through the queued widget-selection cleanup', async () => {
    const fixture = setup()
    // Match the widget editor's pre-flush cleanup after the section list changes.
    fixture.scope.run(() =>
      watch(
        () => fixture.page.value?.sections.map((entry) => entry.id).join(','),
        () => {
          fixture.selectedIds.value = fixture.selectedIds.value.filter((id) =>
            fixture.page.value?.sections.some((entry) => entry.id === id),
          )
        },
      ),
    )
    const focus = vi.fn<() => void>()
    fixture.completed.mockImplementation(() => {
      const current = fixture.commands.capture()
      void nextTick(() => {
        if (current()) focus()
      })
    })
    const cut = fixture.commands.run('cut')
    fixture.confirmations[0]!.resolve(true)
    expect(await cut).toBe(true)
    await nextTick()
    expect(fixture.completed).toHaveBeenCalledExactlyOnceWith('cut')
    expect(focus).toHaveBeenCalledTimes(1)
    expect(fixture.selectedIds.value).toEqual([])
    expect(fixture.page.value!.sections.map((entry) => entry.id)).toEqual(['b'])
    expect(fixture.commands.pending.value).toBe(false)
  })

  const transitions: { name: string; change: (fixture: Fixture) => void }[] = [
    {
      name: 'account A → signed out → A',
      change: (f) => {
        f.identity.value = ''
        f.identity.value = 'admin-a'
      },
    },
    {
      name: 'access revoked and restored',
      change: (f) => {
        f.enabled.value = false
        f.enabled.value = true
      },
    },
    {
      name: 'page away and back',
      change: (f) => {
        f.pageId.value = 'other'
        f.pageId.value = 'home'
      },
    },
    {
      name: 'shared layout and back',
      change: (f) => {
        f.editingLayout.value = true
        f.editingLayout.value = false
      },
    },
    {
      name: 'device away and back',
      change: (f) => {
        f.device.value = 'mobile'
        f.device.value = 'desktop'
      },
    },
    {
      name: 'mode away and back',
      change: (f) => {
        f.mode.value = 'content'
        f.mode.value = 'design'
      },
    },
    {
      name: 'selection away and back',
      change: (f) => {
        f.selectedIds.value = ['b']
        f.selectedIds.value = ['a']
      },
    },
    {
      name: 'draft edit and revert',
      change: (f) => {
        f.site.value!.name = 'Temporary'
        f.site.value!.name = 'Test website'
      },
    },
    {
      name: 'same-ID site replacement',
      change: (f) => {
        f.site.value = JSON.parse(state(f)) as WebsiteSite
      },
    },
    {
      name: 'busy start and finish',
      change: (f) => {
        f.busy.value = true
        f.busy.value = false
      },
    },
    {
      name: 'gesture start and finish',
      change: (f) => {
        f.interacting.value = true
        f.interacting.value = false
      },
    },
  ]

  it.each(transitions)(
    'rejects a stale confirmation after $name synchronously',
    async ({ change }) => {
      const fixture = setup()
      const capture = fixture.commands.capture()
      const before = state(fixture)
      const deletion = fixture.commands.run('delete')
      expect(fixture.commands.pending.value).toBe(true)
      change(fixture)
      expect(capture()).toBe(false)
      expect(fixture.cancelConfirmation).toHaveBeenCalled()
      expect(fixture.commands.pending.value).toBe(false)
      const reports = fixture.report.mock.calls.length
      fixture.confirmations[0]!.resolve(true)
      expect(await deletion).toBe(false)
      expect(state(fixture)).toBe(before)
      expect(fixture.change).not.toHaveBeenCalled()
      expect(fixture.report).toHaveBeenCalledTimes(reports)
    },
  )

  it('does not let an older confirmation clear a newer pending attempt', async () => {
    const fixture = setup()
    const before = state(fixture)
    const older = fixture.commands.run('delete')
    fixture.selectedIds.value = ['b']
    expect(fixture.commands.pending.value).toBe(false)
    const newer = fixture.commands.run('delete')
    expect(fixture.confirm).toHaveBeenCalledTimes(2)
    fixture.confirmations[0]!.resolve(true)
    expect(await older).toBe(false)
    expect(fixture.commands.pending.value).toBe(true)
    expect(state(fixture)).toBe(before)
    fixture.confirmations[1]!.resolve(true)
    expect(await newer).toBe(true)
    expect(fixture.commands.pending.value).toBe(false)
    expect(fixture.page.value!.sections.map((entry) => entry.id)).toEqual(['a'])
    expect(fixture.change).toHaveBeenCalledTimes(1)
  })

  it('does not remove a container after a new child was added while confirmation was pending', async () => {
    const fixture = setup([
      widget('group', { type: 'container' }),
      widget('child', { parentId: 'group' }),
    ])
    const removal = fixture.commands.run('delete')
    fixture.page.value!.sections.push(widget('new-child', { parentId: 'group' }))
    fixture.confirmations[0]!.resolve(true)
    expect(await removal).toBe(false)
    expect(fixture.page.value!.sections.map((entry) => entry.id)).toEqual([
      'group',
      'child',
      'new-child',
    ])
    expect(fixture.change).not.toHaveBeenCalled()
  })

  it('does not revive a previous account clipboard when its pending Cut later succeeds', async () => {
    const fixture = setup()
    await fixture.commands.run('copy')
    const before = state(fixture)
    fixture.selectedIds.value = ['b']
    const cut = fixture.commands.run('cut')
    fixture.identity.value = 'admin-b'
    fixture.confirmations[0]!.resolve(true)
    expect(await cut).toBe(false)
    expect(fixture.commands.clipboard.value).toBeUndefined()
    expect(state(fixture)).toBe(before)
    expect(fixture.change).not.toHaveBeenCalled()
  })

  it('suppresses an old confirmation error without clearing a newer pending operation', async () => {
    const fixture = setup()
    const older = fixture.commands.run('delete')
    fixture.selectedIds.value = ['b']
    const newer = fixture.commands.run('delete')
    const reports = fixture.report.mock.calls.length
    fixture.confirmations[0]!.reject(new Error('Old dialog failed'))
    expect(await older).toBe(false)
    expect(fixture.commands.pending.value).toBe(true)
    expect(fixture.report).toHaveBeenCalledTimes(reports)
    fixture.confirmations[1]!.resolve(false)
    expect(await newer).toBe(false)
    expect(fixture.change).not.toHaveBeenCalled()
  })

  it.each(['identity', 'access'] as const)(
    'clears clipboard immediately when %s changes and does not revive it',
    async (kind) => {
      const fixture = setup()
      await fixture.commands.run('copy')
      expect(fixture.commands.clipboard.value).toBeDefined()
      const transition =
        kind === 'identity'
          ? () => {
              fixture.identity.value = ''
              fixture.identity.value = 'admin-a'
            }
          : () => {
              fixture.enabled.value = false
              fixture.enabled.value = true
            }
      transition()
      expect(fixture.commands.clipboard.value).toBeUndefined()
      expect(await fixture.commands.run('paste')).toBe(false)
      expect(fixture.change).not.toHaveBeenCalled()
    },
  )

  it('recovers from a failed confirmation and allows a later successful retry', async () => {
    const fixture = setup()
    const failure = fixture.commands.run('delete')
    fixture.confirmations[0]!.reject(new Error('Dialog unavailable'))
    expect(await failure).toBe(false)
    expect(fixture.commands.pending.value).toBe(false)
    expect(fixture.change).not.toHaveBeenCalled()
    const retry = fixture.commands.run('delete')
    fixture.confirmations[1]!.resolve(true)
    expect(await retry).toBe(true)
    expect(fixture.page.value!.sections.map((entry) => entry.id)).toEqual(['b'])
  })

  it.each(['explicit', 'scope'] as const)(
    'disposes %s ownership before an accepted confirmation can mutate',
    async (kind) => {
      const fixture = setup()
      await fixture.commands.run('copy')
      const capture = fixture.commands.capture()
      const before = state(fixture)
      const removal = fixture.commands.run('delete')
      const dispose = kind === 'explicit' ? fixture.commands.dispose : () => fixture.scope.stop()
      dispose()
      expect(fixture.commands.clipboard.value).toBeUndefined()
      expect(fixture.commands.pending.value).toBe(false)
      expect(capture()).toBe(false)
      fixture.confirmations[0]!.resolve(true)
      expect(await removal).toBe(false)
      expect(await fixture.commands.run('duplicate')).toBe(false)
      expect(state(fixture)).toBe(before)
      expect(fixture.change).not.toHaveBeenCalled()
    },
  )
})

describe('website command keyboard boundary', () => {
  it('handles native copy, paste, undo and redo from an opted-in widget region', async () => {
    const fixture = setup()
    const { host, press } = keyboard(fixture)
    const button = host.querySelector('button')!
    expect(press(button, 'c', { ctrlKey: true }).defaultPrevented).toBe(true)
    expect(press(button, 'v', { metaKey: true }).defaultPrevented).toBe(true)
    await nextTick()
    expect(fixture.page.value!.sections).toHaveLength(3)
    expect(press(button, 'z', { ctrlKey: true }).defaultPrevented).toBe(true)
    expect(fixture.page.value!.sections).toHaveLength(2)
    expect(press(button, 'z', { ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(true)
    expect(fixture.page.value!.sections).toHaveLength(3)
  })

  it.each([
    '<input>',
    '<textarea></textarea>',
    '<select><option>Option</option></select>',
    '<div contenteditable="true"><span>Text</span></div>',
    '<div role="dialog"><button>Dialog</button></div>',
    '<dialog open><button>Dialog</button></dialog>',
    '<div role="menu"><button>Menu</button></div>',
    '<div role="tablist"><button>Tab</button></div>',
  ])('preserves native shortcuts inside %s', async (markup) => {
    const fixture = setup()
    const { host, press } = keyboard(
      fixture,
      `<section data-website-selection-commands>${markup}</section>`,
    )
    const target = host.querySelector('button,span,input,textarea,select')!
    expect(press(target, 'd', { ctrlKey: true }).defaultPrevented).toBe(false)
    await nextTick()
    expect(fixture.change).not.toHaveBeenCalled()
  })

  it('does not intercept inspector or toolbar controls outside an opted-in region', () => {
    const fixture = setup()
    const { host, press } = keyboard(fixture, '<aside><button>Inspector</button></aside>')
    const target = host.querySelector('button')!
    expect(press(target, 'd', { ctrlKey: true }).defaultPrevented).toBe(false)
    expect(press(target, 'Delete').defaultPrevented).toBe(false)
    expect(fixture.change).not.toHaveBeenCalled()
    expect(fixture.confirm).not.toHaveBeenCalled()
  })

  it.each([
    { name: 'Alt', options: { ctrlKey: true, altKey: true } },
    { name: 'Shift', options: { ctrlKey: true, shiftKey: true } },
    { name: 'composition', options: { ctrlKey: true, isComposing: true } },
    { name: 'simultaneous Ctrl and Meta', options: { ctrlKey: true, metaKey: true } },
  ])('passes through unsupported $name clipboard keys', ({ options }) => {
    const fixture = setup()
    const { host, press } = keyboard(fixture)
    expect(press(host.querySelector('button')!, 'd', options).defaultPrevented).toBe(false)
    expect(fixture.change).not.toHaveBeenCalled()
  })

  it('consumes repeats and empty clipboard actions without mutating or falling through to browser commands', () => {
    const fixture = setup()
    const { host, press } = keyboard(fixture)
    const button = host.querySelector('button')!
    expect(press(button, 'd', { ctrlKey: true, repeat: true }).defaultPrevented).toBe(true)
    expect(press(button, 'v', { ctrlKey: true }).defaultPrevented).toBe(true)
    fixture.selectedIds.value = []
    expect(press(button, 'Delete').defaultPrevented).toBe(true)
    expect(fixture.change).not.toHaveBeenCalled()
    expect(fixture.confirm).not.toHaveBeenCalled()
  })

  it.each(['busy', 'interacting'] as const)(
    'consumes and ignores shortcuts while %s, then permits them after release',
    (reason) => {
      const fixture = setup()
      const { host, press } = keyboard(fixture)
      const button = host.querySelector('button')!
      fixture[reason].value = true
      expect(press(button, 'd', { ctrlKey: true }).defaultPrevented).toBe(true)
      expect(press(button, 'Delete').defaultPrevented).toBe(true)
      expect(fixture.change).not.toHaveBeenCalled()
      expect(fixture.confirm).not.toHaveBeenCalled()
      fixture[reason].value = false
      expect(press(button, 'd', { ctrlKey: true }).defaultPrevented).toBe(true)
      expect(fixture.change).toHaveBeenCalledTimes(1)
    },
  )

  it('does not start another command while its confirmation is pending', async () => {
    const fixture = setup()
    const { host, press } = keyboard(fixture)
    const button = host.querySelector('button')!
    const removal = fixture.commands.run('delete')
    expect(press(button, 'd', { ctrlKey: true }).defaultPrevented).toBe(true)
    expect(press(button, 'x', { ctrlKey: true }).defaultPrevented).toBe(true)
    expect(fixture.confirm).toHaveBeenCalledTimes(1)
    expect(fixture.change).not.toHaveBeenCalled()
    fixture.confirmations[0]!.resolve(false)
    expect(await removal).toBe(false)
  })

  it('consumes a workspace shortcut while another modal is open without changing its background', () => {
    const fixture = setup()
    const { host, press } = keyboard(fixture)
    const dialog = document.createElement('dialog')
    dialog.open = true
    document.body.append(dialog)
    expect(press(host.querySelector('button')!, 'd', { ctrlKey: true }).defaultPrevented).toBe(true)
    expect(fixture.change).not.toHaveBeenCalled()
    expect(fixture.confirm).not.toHaveBeenCalled()
  })

  it.each(['content', 'code'])('leaves %s mode shortcuts alone', (mode) => {
    const fixture = setup()
    fixture.mode.value = mode
    const { host, press } = keyboard(fixture)
    expect(press(host.querySelector('button')!, 'd', { ctrlKey: true }).defaultPrevented).toBe(
      false,
    )
    expect(fixture.change).not.toHaveBeenCalled()
  })

  it('ignores a previously handled event', () => {
    const fixture = setup()
    const { host, press } = keyboard(fixture)
    press(host.querySelector('button')!, 'd', { ctrlKey: true }, true)
    expect(fixture.change).not.toHaveBeenCalled()
  })
})
