import type { InjectionKey, Ref } from 'vue'
import type { RichTextNode } from '../../../functions/src/websiteRichText'

export interface InlineTarget {
  id: string
  field: 'title' | 'text' | 'brand' | 'menu' | 'linkLabel'
  key?: string
}
export interface InlineEditing {
  active: Ref<InlineTarget | undefined>
  enabled: (target: InlineTarget) => boolean
  design: () => boolean
  select: (target: InlineTarget, event: MouseEvent) => void
  begin: (target: InlineTarget) => void
  update: (target: InlineTarget, text: string, format?: 'markdown', rich?: RichTextNode) => void
  end: (target: InlineTarget) => void
}
export const inlineEditingKey: InjectionKey<InlineEditing> = Symbol('website-inline-editing')
export const navigationEditingKey: InjectionKey<(sectionId: string, linkId: string) => void> =
  Symbol('website-navigation-editing')
export const navigationPreviewKey: InjectionKey<{
  pageId: (url: string) => string | undefined
  navigate: (id: string) => void
  openAppLogin: () => void
  edit: (target: InlineTarget) => void
}> = Symbol('website-navigation-preview')
export const itemEditingKey: InjectionKey<(target: InlineTarget) => void> =
  Symbol('website-item-editing')
