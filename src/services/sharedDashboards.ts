import { httpsCallable } from 'firebase/functions'
import { requireFirebaseServices } from '@/firebase'
import { isWorkspaceServerEnabled } from '@/services/workspaceServer'
import type { SharedDashboardLayout } from '@/features/dashboard/sharedDashboards'
import type {
  SharedCalendarEntry,
  PersonalTask,
  AnnouncementDraft,
  PublishedAnnouncement,
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
  'publish-announcement': DashboardContext & { version: number; draftId: string }
  'list-announcement-recipients': DashboardContext & { search?: string; cursor?: string }
  'list-announcements': DashboardContext
  'save-announcement-drafts': DashboardContext & { version: number; announcementDrafts: AnnouncementDraft[] }
  'save-tasks': DashboardContext & { version: number; tasks: PersonalTask[] }
  'save-calendar': DashboardContext & { version: number; events: SharedCalendarEntry[] }
}
type DashboardContent = {
  version: number
  announcementDrafts?: AnnouncementDraft[]
  tasks?: PersonalTask[]
  notes: Record<string, string>
  events: SharedCalendarEntry[]
}
interface DashboardResponses {
  load: SharedDashboardLayout
  'save-template': SharedDashboardLayout
  'save-notes': DashboardContent
  'publish-announcement': { id: string }
  'list-announcement-recipients': { items: { uid: string; name: string; email: string; role: string }[]; nextCursor: string | null }
  'list-announcements': { items: PublishedAnnouncement[]; limit: number }
  'save-announcement-drafts': DashboardContent
  'save-tasks': DashboardContent
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
