export const dashboardWidgetLabels = {
  documents: 'Documents',
  resources: 'Role resources',
  notes: 'Notes',
  shortcuts: 'Quick links',
  form: 'Form',
} as const
export type DashboardWidgetType = keyof typeof dashboardWidgetLabels
export interface DashboardWidget {
  id: string
  type: DashboardWidgetType
  span: 4 | 6 | 8 | 12
  title: string
  text: string
  form?: { templateId: string; version: number; presentation: 'inline' | 'launcher' }
}
export interface DashboardLayout {
  widgets: DashboardWidget[]
  version: number
  canEdit: boolean
}
export function newDashboardWidget(type: DashboardWidgetType): DashboardWidget {
  return {
    id: crypto.randomUUID(),
    type,
    span: type === 'documents' ? 12 : 6,
    title: dashboardWidgetLabels[type],
    text: '',
  }
}
