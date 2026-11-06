import { normalizeStoredRole, type FunctionUserRoleProfile } from './roleAccess'
// Announcement delivery is narrower than general workforce access.
export function isActiveAnnouncementProfile(profile: FunctionUserRoleProfile): boolean {
  return profile.active !== false && normalizeStoredRole(profile.role) !== 'none'
}
