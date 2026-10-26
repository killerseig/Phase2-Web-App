import { isE2EActive } from '@/testing/e2eRuntime'
import { hasConfiguredFirebase } from './firebaseConfig'

declare global {
  interface Window {
    // Existing synthetic fixtures use this flag for server-backed workspaces.
    __PHASE2_FORM_SERVER__?: boolean
  }
}

export function isWorkspaceServerEnabled(): boolean {
  if (isE2EActive()) return window.__PHASE2_FORM_SERVER__ === true
  return hasConfiguredFirebase
}
