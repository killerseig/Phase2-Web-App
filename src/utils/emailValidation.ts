/**
 * Email Validation Utility
 * Provides consistent email validation across the application
 */

/**
 * Validates email address format
 * Requirements:
 * - Must contain @ symbol
 * - Must contain . (domain extension)
 * - No leading/trailing whitespace
 * - Basic format validation
 */
export function isValidEmail(email: string): boolean {
  const trimmedEmail = email.trim()
  
  // Must not be empty
  if (!trimmedEmail) {
    return false
  }
  
  // Basic regex validation: something@something.something
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(trimmedEmail)
}

/**
 * Validates multiple email addresses
 * Returns { valid: string[], invalid: string[] }
 */
export function validateEmailList(emails: string[]): { valid: string[]; invalid: string[] } {
  const valid: string[] = []
  const invalid: string[] = []

  for (const email of emails) {
    if (isValidEmail(email)) {
      valid.push(email.trim())
    } else {
      invalid.push(email.trim())
    }
  }

  return { valid, invalid }
}
