import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureWebsiteWidgets, planWebsitePaste, type WebsitePastePlan } from './widgetClipboard'
import { newItem, newSection, type SectionType, type WebsiteSection } from './types'

const context = 'project:user:page:home'
const options = { context }
function widget(id: string, type: SectionType = 'text', parentId?: string): WebsiteSection {
  return {
    ...newSection(type),
    id,
    ...(parentId ? { parentId } : {}),
    layout: { x: 2.12749, y: 3.23453, w: 8.31217, h: 6.18741, z: 1 },
  }
}
function success(plan: WebsitePastePlan) {
  expect(plan.ok).toBe(true)
  if (!plan.ok) throw new Error(plan.error)
  return plan
}
afterEach(() => vi.restoreAllMocks())

describe('Website widget clipboard', () => {
  it('uses current occupancy for distinct repeated paste, duplicate and Undo placement', () => {
    const source = [widget('card')]
    const captured = captureWebsiteWidgets(source, ['card'], context)!
    const first = success(planWebsitePaste(captured, source, options))
    const second = success(planWebsitePaste(captured, [...source, ...first.sections], options))
    expect(first.sections[0]!.layout!.x).toBe(source[0]!.layout!.x + 1)
    expect(second.sections[0]!.layout!.x).toBe(source[0]!.layout!.x + 2)
    expect(first.sections[0]!.id).not.toBe(second.sections[0]!.id)
    const duplicate = success(
      planWebsitePaste(
        captureWebsiteWidgets([...source, ...first.sections], first.roots, context)!,
        [...source, ...first.sections],
        options,
      ),
    )
    expect(duplicate.sections[0]!.layout!.x).toBe(second.sections[0]!.layout!.x)
    const afterUndo = success(planWebsitePaste(captured, [...source, ...first.sections], options))
    expect(afterUndo.sections[0]!.layout).toEqual(second.sections[0]!.layout)
    expect(captured.sections[0]!.layout).toEqual(source[0]!.layout)
  })

  it('normalizes roots, includes hidden descendants, preserves child geometry and relative root spacing', () => {
    const parent = widget('parent', 'container'),
      child = { ...widget('child', 'text', 'parent'), hidden: true, locked: true }
    const second = { ...widget('second'), layout: { ...parent.layout!, x: 20.12749, z: 0 } }
    const source = [parent, child, second],
      before = structuredClone(source)
    const captured = captureWebsiteWidgets(source, ['parent', 'child', 'second'], context)!
    expect(captured.roots).toEqual(['parent', 'second'])
    const plan = success(
      planWebsitePaste(captured, source, { ...options, spacing: { x: 0.25, y: 0.5 } }),
    )
    expect(plan.roots).toEqual([plan.sections[0]!.id, plan.sections[2]!.id])
    expect(plan.sections[1]!.parentId).toBe(plan.sections[0]!.id)
    expect(plan.sections[1]!.layout).toEqual(child.layout)
    expect(plan.sections[1]!.hidden).toBe(true)
    expect(plan.sections[1]!.locked).toBe(true)
    expect(plan.sections[2]!.layout!.x - plan.sections[0]!.layout!.x).toBeCloseTo(18, 10)
    expect(plan.sections[0]!.layout!.z).toBeGreaterThan(plan.sections[2]!.layout!.z)
    expect(source).toEqual(before)
  })

  it('retains copied layout locks and permits insertion only into the original unlocked external parent', () => {
    const parent = widget('parent', 'container'),
      child = { ...widget('child', 'text', 'parent'), locked: true }
    const source = [parent, child],
      captured = captureWebsiteWidgets(source, ['child'], context)!
    const copied = success(planWebsitePaste(captured, source, options)).sections[0]!
    expect(copied.parentId).toBe(parent.id)
    expect(copied.locked).toBe(true)
    expect(copied.layout).toEqual(child.layout)
    expect(
      planWebsitePaste(captured, source, { context: 'project:user:page:other' }),
    ).toMatchObject({ ok: false })
    expect(planWebsitePaste(captured, [], options)).toMatchObject({ ok: false })
    expect(planWebsitePaste(captured, [{ ...parent, locked: true }, child], options)).toMatchObject(
      { ok: false },
    )
    const copiedTree = success(
      planWebsitePaste(captureWebsiteWidgets(source, ['parent'], context)!, [], {
        context: 'project:user:page:other',
      }),
    )
    expect(copiedTree.sections[1]!.parentId).toBe(copiedTree.sections[0]!.id)
  })

  it('deeply isolates rich text, image styles, navigation labels and responsive overrides', () => {
    const source = [widget('nav', 'navigation')]
    source[0]!.appearance = { motion: { effect: 'fade', duration: 300 } }
    source[0]!.items = [
      {
        ...newItem(),
        imageSettings: { darken: 25 },
        titleRichText: { type: 'doc', content: [{ type: 'text', text: 'Card' }] },
      },
    ]
    source[0]!.devices = {
      mobile: { appearance: { fontSize: 16, motion: { effect: 'rise' } }, sizing: { height: 100 } },
    }
    source[0]!.navigation!.pageLabels = [{ id: 'company-page', label: 'Company' }]
    source[0]!.navigation!.links = [
      {
        id: 'menu',
        label: 'Services',
        url: '/services',
        children: [
          {
            id: 'sub',
            label: 'Plan',
            url: '/planning',
            labelRichText: { type: 'doc', content: [{ type: 'text', text: 'Plan' }] },
          },
        ],
      },
    ]
    const captured = captureWebsiteWidgets(source, ['nav'], context)!,
      before = structuredClone(source)
    const copy = success(planWebsitePaste(captured, source, options)).sections[0]!
    expect(copy.items[0]!.id).not.toBe(source[0]!.items[0]!.id)
    expect(copy.navigation!.links[0]!.id).not.toBe('menu')
    expect(copy.navigation!.links[0]!.children![0]!.id).not.toBe('sub')
    expect(copy.navigation!.pageLabels).toEqual(source[0]!.navigation!.pageLabels)
    expect(copy.navigation!.links[0]!.children![0]!.url).toBe('/planning')
    expect(copy.devices).toEqual(source[0]!.devices)
    copy.appearance!.motion!.duration = 900
    copy.items[0]!.imageSettings!.darken = 99
    copy.items[0]!.titleRichText!.content![0]!.text = 'Changed'
    copy.devices!.mobile!.appearance!.motion!.effect = 'zoom'
    copy.navigation!.links[0]!.children![0]!.labelRichText!.content![0]!.text = 'Changed'
    expect(source).toEqual(before)
    expect(captured.sections).toEqual(before)
  })

  it('preserves shared library references and remaps owned inline definitions and bindings', () => {
    const form = { ...widget('form', 'form'), formId: 'shared-form' }
    const linked = {
      ...widget('linked', 'custom'),
      custom: { definitionId: 'shared-widget', values: { heading: 'Shared' } },
    }
    const inlineChild = { ...widget('inside', 'cards'), items: [newItem()] }
    const inline = {
      ...widget('inline', 'custom'),
      custom: {
        values: { heading: 'Detached' },
        inline: {
          id: 'definition',
          name: 'Detached',
          kind: 'visual' as const,
          sections: [inlineChild],
          html: '<website-widget id="inside"></website-widget>',
          css: '.card { color: blue; }',
          fields: [
            {
              key: 'heading',
              label: 'Heading',
              type: 'text' as const,
              defaultValue: 'Default',
              sectionId: 'inside',
              property: 'title' as const,
            },
          ],
        },
      },
    }
    const source = [form, linked, inline],
      captured = captureWebsiteWidgets(
        source,
        source.map((entry) => entry.id),
        context,
      )!
    const plan = success(
      planWebsitePaste(captured, [], {
        ...options,
        formIds: ['shared-form'],
        widgetIds: ['shared-widget'],
      }),
    )
    expect(plan.sections[0]!.formId).toBe('shared-form')
    expect(plan.sections[1]!.custom).toEqual(linked.custom)
    const definition = plan.sections[2]!.custom!.inline!
    expect(definition.id).not.toBe('definition')
    expect(definition.sections[0]!.id).not.toBe('inside')
    expect(definition.sections[0]!.items[0]!.id).not.toBe(inlineChild.items[0]!.id)
    expect(definition.fields[0]!.sectionId).toBe(definition.sections[0]!.id)
    expect(definition.html).toContain(`id="${definition.sections[0]!.id}"`)
    expect(definition.css).toBe(inline.custom.inline.css)
    expect(plan.sections[2]!.custom!.values).toEqual(inline.custom.values)
    expect(
      planWebsitePaste(captured, [], { ...options, formIds: [], widgetIds: ['shared-widget'] }),
    ).toMatchObject({ ok: false })
    expect(
      planWebsitePaste(captured, [], { ...options, formIds: ['shared-form'], widgetIds: [] }),
    ).toMatchObject({ ok: false })
  })

  it('keeps flow copies flowing and resolves only new roots when entering a positioned page', () => {
    const legacy = widget('legacy'),
      child = widget('child', 'text', 'container'),
      container = widget('container', 'container')
    delete legacy.layout
    const captured = captureWebsiteWidgets([legacy], ['legacy'], context)!
    const flow = success(planWebsitePaste(captured, [], { ...options, positioned: false }))
    expect(flow.sections[0]!.layout).toBeUndefined()
    const grid = success(planWebsitePaste(captured, [], options))
    expect(grid.sections[0]!.layout).toBeDefined()
    expect(legacy.layout).toBeUndefined()
    const tree = [container, child]
    const flowing = success(
      planWebsitePaste(captureWebsiteWidgets(tree, ['container'], context)!, tree, {
        ...options,
        positioned: false,
        point: { x: 100, y: 100 },
      }),
    )
    expect(flowing.sections[0]!.layout!.x).toBe(container.layout!.x)
    expect(flowing.sections[1]!.layout).toEqual(child.layout)
  })

  it('uses the existing top-left context-menu anchor and avoids repeated exact overlap', () => {
    const source = [widget('card')],
      captured = captureWebsiteWidgets(source, ['card'], context)!
    const first = success(
      planWebsitePaste(captured, source, { ...options, point: { x: 20, y: 25 } }),
    )
    expect(first.sections[0]!.layout).toMatchObject({ x: 20, y: 25 })
    const second = success(
      planWebsitePaste(captured, [...source, ...first.sections], {
        ...options,
        point: { x: 20, y: 25 },
      }),
    )
    expect(second.sections[0]!.layout).toMatchObject({ x: 21, y: 26 })
  })

  it('clamps boundary placements together and reports when no distinct position fits', () => {
    const edge = widget('edge')
    edge.layout = { x: 990.12749, y: 9990.23453, w: 1000 - 990.12749, h: 10000 - 9990.23453, z: 1 }
    const copied = success(
      planWebsitePaste(captureWebsiteWidgets([edge], ['edge'], context)!, [edge], options),
    ).sections[0]!
    expect(copied.layout!.x + copied.layout!.w).toBeLessThanOrEqual(1000)
    expect(copied.layout!.y + copied.layout!.h).toBeLessThanOrEqual(10000)
    expect([copied.layout!.x, copied.layout!.y]).not.toEqual([edge.layout.x, edge.layout.y])
    const full = { ...widget('full'), layout: { x: 0, y: 0, w: 1000, h: 10000, z: 1 } }
    expect(
      planWebsitePaste(captureWebsiteWidgets([full], ['full'], context)!, [full], options),
    ).toMatchObject({ ok: false })
  })

  it('returns atomic layer patches at the ceiling without mutating existing fields or locked layers', () => {
    const source = [widget('high'), widget('low')]
    source[0]!.layout!.z = 10000
    source[1]!.layout!.z = 3
    const captured = captureWebsiteWidgets(source, ['high'], context)!,
      before = structuredClone(source)
    const plan = success(planWebsitePaste(captured, source, options))
    expect(plan.layouts).toEqual({
      low: { ...source[1]!.layout!, z: 1 },
      high: { ...source[0]!.layout!, z: 2 },
    })
    expect(plan.sections[0]!.layout!.z).toBe(3)
    expect(source).toEqual(before)
    expect(
      planWebsitePaste(captured, [{ ...source[0]!, locked: true }, source[1]!], options),
    ).toMatchObject({ ok: false })
  })

  it('protects the page-content slot, rejects invalid trees and enforces the 30-widget limit atomically', () => {
    const slot = widget('slot', 'page-content')
    expect(captureWebsiteWidgets([slot], ['slot'], context)).toBeUndefined()
    const source = [widget('card')],
      captured = captureWebsiteWidgets(source, ['card'], context)!
    const destination = Array.from({ length: 30 }, (_, index) => widget(`item-${index}`)),
      before = structuredClone(destination)
    expect(planWebsitePaste(captured, destination, options)).toMatchObject({ ok: false })
    expect(destination).toEqual(before)
    expect(
      planWebsitePaste({ ...captured, sections: [slot], roots: ['slot'] }, [], options),
    ).toMatchObject({ ok: false })
    expect(planWebsitePaste({ ...captured, roots: ['missing'] }, [], options)).toMatchObject({
      ok: false,
    })
    expect(
      planWebsitePaste(
        { ...captured, sections: [...captured.sections, ...captured.sections] },
        [],
        options,
      ),
    ).toMatchObject({ ok: false })
    expect(planWebsitePaste(captured, [], { ...options, spacing: { x: 0, y: 1 } })).toMatchObject({
      ok: false,
    })
  })

  it('fails safely if fresh IDs cannot be generated', () => {
    const source = [widget('existing')],
      captured = captureWebsiteWidgets(source, ['existing'], context)!
    const uuid = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('existing' as ReturnType<typeof crypto.randomUUID>)
    expect(planWebsitePaste(captured, source, options)).toMatchObject({ ok: false })
    expect(uuid).toHaveBeenCalledTimes(8)
    expect(source[0]!.id).toBe('existing')
  })
})
