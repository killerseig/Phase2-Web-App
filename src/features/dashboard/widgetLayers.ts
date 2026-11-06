export type LayerAction = 'back' | 'backward' | 'forward' | 'front'

type LayerWidget = { id: string; parentId?: string; region?: string }
export interface WidgetLayer {
  /** Zero-based position among siblings, from back to front. */
  index: number
  count: number
  parentId: string
  region: string
}

function siblingKey(widget: LayerWidget) {
  return JSON.stringify([widget.parentId || '', widget.region || '0'])
}

export function widgetLayer(widgets: readonly LayerWidget[], id: string): WidgetLayer | undefined {
  const widget = widgets.find((entry) => entry.id === id)
  if (!widget) return
  const siblings = widgets.filter((entry) => siblingKey(entry) === siblingKey(widget))
  return {
    index: siblings.findIndex((entry) => entry.id === id),
    count: siblings.length,
    parentId: widget.parentId || '',
    region: widget.region || '0',
  }
}

/**
 * Array order is the saved layer order within each parent/region. Reorder only
 * those sibling slots; child lists, geometry and widget contents stay untouched.
 * Callers materialize legacy flow geometry before applying a layer change.
 */
export function reorderWidgetLayers<T extends LayerWidget>(
  widgets: readonly T[],
  ids: readonly string[],
  action: LayerAction,
): T[] {
  const byId = new Map(widgets.map((widget) => [widget.id, widget]))
  const requested = new Set(ids.filter((id) => byId.has(id)))
  const selected = new Set(
    widgets
      .filter((widget) => {
        if (!requested.has(widget.id)) return false
        const seen = new Set<string>()
        let parent = widget.parentId
        while (parent && !seen.has(parent)) {
          if (requested.has(parent)) return false
          seen.add(parent)
          parent = byId.get(parent)?.parentId
        }
        return true
      })
      .map((widget) => widget.id),
  )
  const groups = new Map<string, number[]>()
  widgets.forEach((widget, index) => {
    const key = siblingKey(widget)
    const indices = groups.get(key) || []
    indices.push(index)
    groups.set(key, indices)
  })
  const result = widgets.slice()
  for (const indices of groups.values()) {
    let siblings = indices.map((index) => widgets[index]!)
    if (!siblings.some((widget) => selected.has(widget.id))) continue
    const isSelected = (widget: T) => selected.has(widget.id)
    if (action === 'back' || action === 'front') {
      const chosen = siblings.filter(isSelected)
      const remaining = siblings.filter((widget) => !isSelected(widget))
      siblings = action === 'back' ? [...chosen, ...remaining] : [...remaining, ...chosen]
    } else if (action === 'backward') {
      for (let index = 1; index < siblings.length; index++) {
        if (isSelected(siblings[index]!) && !isSelected(siblings[index - 1]!))
          [siblings[index - 1], siblings[index]] = [siblings[index]!, siblings[index - 1]!]
      }
    } else {
      for (let index = siblings.length - 2; index >= 0; index--) {
        if (isSelected(siblings[index]!) && !isSelected(siblings[index + 1]!))
          [siblings[index], siblings[index + 1]] = [siblings[index + 1]!, siblings[index]!]
      }
    }
    indices.forEach((index, position) => {
      result[index] = siblings[position]!
    })
  }
  return result
}

export function canReorderWidgetLayers(
  widgets: readonly LayerWidget[],
  ids: readonly string[],
  action: LayerAction,
) {
  return reorderWidgetLayers(widgets, ids, action).some(
    (widget, index) => widget !== widgets[index],
  )
}
