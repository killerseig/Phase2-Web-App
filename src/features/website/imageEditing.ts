import type { InjectionKey, Ref } from 'vue'

export interface ImageTarget {
  sectionId: string
  itemId: string
}
export const imageOwnerKey: InjectionKey<Ref<{ sectionId: string; preview: boolean }>> =
  Symbol('website-image-owner')
export const imageEditingKey: InjectionKey<{
  enabled: (target: ImageTarget) => boolean
  begin: (target: ImageTarget, ratio: number, contain: boolean) => void
}> = Symbol('website-image-editing')
