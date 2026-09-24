import type { InjectionKey, Ref } from 'vue'
import type { TextBox } from '../../../functions/src/websiteTextBox'
import type { InlineTarget } from './inlineEditing'
import type { WebsiteDevice } from './types'
export type ElementTarget = Omit<InlineTarget, 'field'> & {
  field: InlineTarget['field'] | 'image' | 'button'
}

export const textBoxValueKey: InjectionKey<(target: ElementTarget) => TextBox | undefined> =
  Symbol('text-box-value')
export const textBoxEditingKey: InjectionKey<{
  selected: Ref<ElementTarget | undefined>
  device: Ref<WebsiteDevice>
  register: (target: ElementTarget, element: HTMLElement) => () => void
  enabled: (target: ElementTarget) => boolean
  select: (target: ElementTarget) => void
  save: (target: ElementTarget, box: TextBox) => void
}> = Symbol('text-box-editing')

export function sameText(a?: ElementTarget, b?: ElementTarget) {
  return !!a && !!b && a.id === b.id && a.field === b.field && a.key === b.key
}
