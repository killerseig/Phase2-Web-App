import { httpsCallable } from 'firebase/functions'
import { requireFirebaseServices } from '@/firebase'
import { isWorkspaceServerEnabled } from '@/services/workspaceServer'
import type { SharedDashboardLayout } from '@/features/dashboard/sharedDashboards'
import type {
  SharedCalendarEntry,
  SharedDashboardScope,
  SharedDashboardWidget,
} from '@/features/dashboard/sharedDashboards'
export interface DashboardContext {
  scope: SharedDashboardScope
  jobId?: string
  role?: string
}
interface DashboardRequests {
  load: DashboardContext
  'save-template': DashboardContext & {
    version: number
    widgets: SharedDashboardWidget[]
    allowRoleEditing?: boolean
  }
  'save-notes': DashboardContext & { version: number; widgetId: string; text: string }
  'save-calendar': DashboardContext & { version: number; events: SharedCalendarEntry[] }
}
type DashboardContent = {
  version: number
  notes: Record<string, string>
  events: SharedCalendarEntry[]
}
interface DashboardResponses {
  load: SharedDashboardLayout
  'save-template': SharedDashboardLayout
  'save-notes': DashboardContent
  'save-calendar': DashboardContent
}
export async function sharedDashboardCommand<A extends keyof DashboardRequests>(
  action: A,
  data: DashboardRequests[A],
): Promise<DashboardResponses[A]> {
  if (!isWorkspaceServerEnabled())
    throw new Error('Start the local emulator profile to review the new dashboards.')
  return (
    await httpsCallable<Record<string, unknown>, DashboardResponses[A]>(
      requireFirebaseServices().functions,
      'sharedDashboardWorkspace',
    )({ ...data, action })
  ).data
}
