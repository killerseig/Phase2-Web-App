export type TargetFunctionRoleKey =
  | 'admin'
  | 'payroll'
  | 'shop-foreman'
  | 'project-manager'
  | 'foreman'
  | 'none'

export interface TargetFunctionRoleCapabilities {
  accessWorkspace: boolean
  createJobs: boolean
  deleteOrArchiveJobs: boolean
  deleteDraftTimecardWeeks: boolean
  editAllJobs: boolean
  editAssignedFieldWorkflows: boolean
  editAssignedTimecards: boolean
  editAssignedJobs: boolean
  editShopJobFieldWorkflows: boolean
  editShopJobTimecards: boolean
  lockTimecards: boolean
  manageEmployees: boolean
  manageReferenceLists: boolean
  manageShopCatalog: boolean
  manageUsers: boolean
  receiveAssignedJobFieldEmails: boolean
  receiveShopJobFieldEmails: boolean
  useAssignedJobDashboards: boolean
  useShopJobDashboard: boolean
  useTimecardExport: boolean
  viewAllJobs: boolean
  viewSubmittedAssignedTimecards: boolean
}

export const TARGET_FUNCTION_BUILT_IN_ROLE_KEYS = [
  'admin',
  'payroll',
  'shop-foreman',
  'project-manager',
  'foreman',
] as const satisfies readonly Exclude<TargetFunctionRoleKey, 'none'>[]

export const TARGET_FUNCTION_ROLE_CAPABILITIES: Readonly<Record<TargetFunctionRoleKey, TargetFunctionRoleCapabilities>> = {
  admin: {
    accessWorkspace: true,
    createJobs: true,
    deleteOrArchiveJobs: true,
    deleteDraftTimecardWeeks: true,
    editAllJobs: true,
    editAssignedFieldWorkflows: true,
    editAssignedTimecards: true,
    editAssignedJobs: true,
    editShopJobFieldWorkflows: true,
    editShopJobTimecards: true,
    lockTimecards: true,
    manageEmployees: true,
    manageReferenceLists: true,
    manageShopCatalog: true,
    manageUsers: true,
    receiveAssignedJobFieldEmails: false,
    receiveShopJobFieldEmails: false,
    useAssignedJobDashboards: true,
    useShopJobDashboard: true,
    useTimecardExport: true,
    viewAllJobs: true,
    viewSubmittedAssignedTimecards: true,
  },
  payroll: {
    accessWorkspace: true,
    createJobs: true,
    deleteOrArchiveJobs: false,
    deleteDraftTimecardWeeks: true,
    editAllJobs: false,
    editAssignedFieldWorkflows: false,
    editAssignedTimecards: false,
    editAssignedJobs: false,
    editShopJobFieldWorkflows: false,
    editShopJobTimecards: false,
    lockTimecards: true,
    manageEmployees: true,
    manageReferenceLists: false,
    manageShopCatalog: false,
    manageUsers: false,
    receiveAssignedJobFieldEmails: false,
    receiveShopJobFieldEmails: false,
    useAssignedJobDashboards: false,
    useShopJobDashboard: false,
    useTimecardExport: true,
    viewAllJobs: true,
    viewSubmittedAssignedTimecards: false,
  },
  'shop-foreman': {
    accessWorkspace: true,
    createJobs: false,
    deleteOrArchiveJobs: false,
    deleteDraftTimecardWeeks: false,
    editAllJobs: false,
    editAssignedFieldWorkflows: true,
    editAssignedTimecards: true,
    editAssignedJobs: false,
    editShopJobFieldWorkflows: true,
    editShopJobTimecards: true,
    lockTimecards: false,
    manageEmployees: false,
    manageReferenceLists: false,
    manageShopCatalog: true,
    manageUsers: false,
    receiveAssignedJobFieldEmails: true,
    receiveShopJobFieldEmails: true,
    useAssignedJobDashboards: true,
    useShopJobDashboard: true,
    useTimecardExport: false,
    viewAllJobs: true,
    viewSubmittedAssignedTimecards: false,
  },
  'project-manager': {
    accessWorkspace: true,
    createJobs: false,
    deleteOrArchiveJobs: false,
    deleteDraftTimecardWeeks: false,
    editAllJobs: false,
    editAssignedFieldWorkflows: true,
    editAssignedTimecards: false,
    editAssignedJobs: true,
    editShopJobFieldWorkflows: false,
    editShopJobTimecards: false,
    lockTimecards: false,
    manageEmployees: false,
    manageReferenceLists: false,
    manageShopCatalog: false,
    manageUsers: false,
    receiveAssignedJobFieldEmails: true,
    receiveShopJobFieldEmails: false,
    useAssignedJobDashboards: true,
    useShopJobDashboard: false,
    useTimecardExport: false,
    viewAllJobs: false,
    viewSubmittedAssignedTimecards: true,
  },
  foreman: {
    accessWorkspace: true,
    createJobs: false,
    deleteOrArchiveJobs: false,
    deleteDraftTimecardWeeks: false,
    editAllJobs: false,
    editAssignedFieldWorkflows: true,
    editAssignedTimecards: true,
    editAssignedJobs: false,
    editShopJobFieldWorkflows: false,
    editShopJobTimecards: false,
    lockTimecards: false,
    manageEmployees: false,
    manageReferenceLists: false,
    manageShopCatalog: false,
    manageUsers: false,
    receiveAssignedJobFieldEmails: true,
    receiveShopJobFieldEmails: false,
    useAssignedJobDashboards: true,
    useShopJobDashboard: false,
    useTimecardExport: false,
    viewAllJobs: false,
    viewSubmittedAssignedTimecards: false,
  },
  none: {
    accessWorkspace: false,
    createJobs: false,
    deleteOrArchiveJobs: false,
    deleteDraftTimecardWeeks: false,
    editAllJobs: false,
    editAssignedFieldWorkflows: false,
    editAssignedTimecards: false,
    editAssignedJobs: false,
    editShopJobFieldWorkflows: false,
    editShopJobTimecards: false,
    lockTimecards: false,
    manageEmployees: false,
    manageReferenceLists: false,
    manageShopCatalog: false,
    manageUsers: false,
    receiveAssignedJobFieldEmails: false,
    receiveShopJobFieldEmails: false,
    useAssignedJobDashboards: false,
    useShopJobDashboard: false,
    useTimecardExport: false,
    viewAllJobs: false,
    viewSubmittedAssignedTimecards: false,
  },
}

export function isTargetFunctionRoleKey(value: unknown): value is TargetFunctionRoleKey {
  return (
    value === 'admin'
    || value === 'payroll'
    || value === 'shop-foreman'
    || value === 'project-manager'
    || value === 'foreman'
    || value === 'none'
  )
}

export function normalizeTargetFunctionRoleKey(value: unknown): TargetFunctionRoleKey {
  if (typeof value !== 'string') return 'none'

  const normalized = normalizeTargetFunctionRoleAlias(value)
  return isTargetFunctionRoleKey(normalized) ? normalized : 'none'
}

function normalizeTargetFunctionRoleAlias(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[\s_]+/g, '-')
  if (normalized === 'shopforeman') return 'shop-foreman'
  if (normalized === 'projectmanager') return 'project-manager'
  return normalized
}

export function getTargetFunctionRoleCapabilities(role: TargetFunctionRoleKey): TargetFunctionRoleCapabilities {
  return TARGET_FUNCTION_ROLE_CAPABILITIES[role]
}

export function targetFunctionRoleCanBeAssignedJobs(role: TargetFunctionRoleKey): boolean {
  return role === 'foreman' || role === 'project-manager' || role === 'shop-foreman'
}
