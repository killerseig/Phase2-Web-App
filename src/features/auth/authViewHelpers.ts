import type { RouteLocationRaw } from 'vue-router'
import { readFirstQueryParam } from '@/utils/routerQuery'

export const passwordCreatedLoginMessage = 'Password created. Sign in with your new password.'
export const invalidSetupLinkMessage = 'Invalid setup link. Please request a new password creation link.'

export function buildForgotPasswordTarget(email: string): RouteLocationRaw {
  const nextEmail = email.trim()
  return {
    name: 'forgot-password',
    query: nextEmail ? { email: nextEmail } : undefined,
  }
}

export function getPasswordCreatedLoginInfo(value: unknown) {
  return readFirstQueryParam(value) === '1' ? passwordCreatedLoginMessage : ''
}

export function getAuthEmailQueryPrefill(query: { email?: unknown }) {
  return readFirstQueryParam(query.email)
}

export async function redirectToWorkspaceIfAllowed(options: {
  hasWorkspaceAccess: boolean
  replace: (target: string) => Promise<unknown> | unknown
  workspaceTarget?: string
}) {
  if (!options.hasWorkspaceAccess) return false
  await options.replace(options.workspaceTarget ?? '/jobs')
  return true
}

export function getLoginValidationMessage(email: string, password: string) {
  if (!email.trim() || !password) return 'Enter your email and password.'
  return ''
}

export function getForgotPasswordValidationMessage(email: string) {
  if (!email.trim()) return 'Enter your email first.'
  return ''
}

export function getSetPasswordValidationMessage(password: string, confirmPassword: string) {
  if (!password.trim()) return 'Password is required.'
  if (password.length < 6) return 'Password must be at least 6 characters.'
  if (password !== confirmPassword) return 'Passwords do not match.'
  return ''
}

export function readSetupLinkParams(query: { setupToken?: unknown; uid?: unknown }) {
  return {
    setupToken: readFirstQueryParam(query.setupToken),
    uid: readFirstQueryParam(query.uid),
  }
}
