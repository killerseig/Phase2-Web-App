import { defineBoolean, defineSecret, defineString } from 'firebase-functions/params'

const DEFAULT_APP_BASE_URL = 'https://phase2-website.web.app'
const DEFAULT_GRAPH_SECRET_EXPIRATION_DATE = '2027-02-09'

export const graphClientId = defineSecret('GRAPH_CLIENT_ID')
export const graphTenantId = defineSecret('GRAPH_TENANT_ID')
export const graphClientSecret = defineSecret('GRAPH_CLIENT_SECRET')
export const outlookSenderEmail = defineSecret('OUTLOOK_SENDER_EMAIL')

export const emailEnabled = defineBoolean('EMAIL_ENABLED', { default: true })
export const appBaseUrl = defineString('APP_BASE_URL', { default: DEFAULT_APP_BASE_URL })
export const graphSecretExpirationDate = defineString('GRAPH_SECRET_EXPIRATION_DATE', {
  default: DEFAULT_GRAPH_SECRET_EXPIRATION_DATE,
})

export function getGraphEmailSecrets() {
  return [
    graphClientId,
    graphTenantId,
    graphClientSecret,
    outlookSenderEmail,
  ]
}

export function getAppBaseUrl(): string {
  return String(appBaseUrl.value() || DEFAULT_APP_BASE_URL).replace(/\/+$/, '')
}

export function getGraphSecretExpirationDate(): string {
  return String(graphSecretExpirationDate.value() || DEFAULT_GRAPH_SECRET_EXPIRATION_DATE)
}
