import type { InjectionKey } from 'vue'
export interface WebsiteRuntimeServices {
  images: Record<string, string>
  preview: boolean
  submit: (data: Record<string, unknown>) => Promise<unknown>
}
export const websiteRuntimeKey: InjectionKey<WebsiteRuntimeServices> = Symbol('website-runtime')
