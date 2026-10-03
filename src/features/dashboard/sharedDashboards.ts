export {
  defaultSharedWidgets,
  sharedWidgetLabels,
  sharedWidgetTypes,
} from '../../../functions/src/sharedDashboardModel'
export type {
  SharedDashboardWidget,
  SharedDashboardWidgetType,
  SharedDashboardScope,
  SharedCalendarEntry,
} from '../../../functions/src/sharedDashboardModel'
import type { SharedDashboardWidget } from '../../../functions/src/sharedDashboardModel'
export interface SharedDashboardJob {
  id: string
  name: string
  code: string
  gc: string
  jobAddress: string
  startDate: string
  finishDate: string
  active: boolean
}
export interface SharedDashboardLayout {
  widgets: SharedDashboardWidget[]
  version: number
  canEdit: boolean
  role: string
  allowRoleEditing: boolean
  job: SharedDashboardJob | null
  notes: Record<string, string>
  notesVersion: number
  events: import('../../../functions/src/sharedDashboardModel').SharedCalendarEntry[]
}
export function newSharedWidget(type: SharedDashboardWidget['type']): SharedDashboardWidget {
  return { id: crypto.randomUUID(), type, span: 6, title: '', text: '' }
}
