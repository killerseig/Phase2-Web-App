/**
 * Form Validation Utilities
 * Centralized validation rules and error messages
 */

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

// Validation patterns
export const PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\d{3}-\d{3}-\d{4}$/,
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
} as const

// Error messages
export const VALIDATION_MESSAGES = {
  REQUIRED: (field: string) => `${field} is required`,
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PHONE: 'Phone must be in format: 123-456-7890',
  MIN_LENGTH: (field: string, length: number) => `${field} must be at least ${length} characters`,
  MAX_LENGTH: (field: string, length: number) => `${field} cannot exceed ${length} characters`,
  PATTERN_MISMATCH: (field: string) => `${field} format is invalid`,
  DUPLICATE: (field: string) => `${field} already exists`,
} as const

/**
 * Validate a required field
 */
export function validateRequired(value: string | null | undefined, fieldName: string): ValidationError[] {
  if (!value || !value.trim()) {
    return [{ field: fieldName, message: VALIDATION_MESSAGES.REQUIRED(fieldName) }]
  }
  return []
}

/**
 * Validate email format
 */
export function validateEmail(email: string | null | undefined): ValidationError[] {
  if (!email || !email.trim()) {
    return [{ field: 'email', message: VALIDATION_MESSAGES.REQUIRED('Email') }]
  }
  if (!PATTERNS.EMAIL.test(email)) {
    return [{ field: 'email', message: VALIDATION_MESSAGES.INVALID_EMAIL }]
  }
  return []
}

/**
 * Validate minimum length
 */
export function validateMinLength(
  value: string | null | undefined,
  fieldName: string,
  minLength: number
): ValidationError[] {
  if (!value || value.length < minLength) {
    return [{ field: fieldName, message: VALIDATION_MESSAGES.MIN_LENGTH(fieldName, minLength) }]
  }
  return []
}

/**
 * Validate maximum length
 */
export function validateMaxLength(
  value: string | null | undefined,
  fieldName: string,
  maxLength: number
): ValidationError[] {
  if (value && value.length > maxLength) {
    return [{ field: fieldName, message: VALIDATION_MESSAGES.MAX_LENGTH(fieldName, maxLength) }]
  }
  return []
}

/**
 * Validate pattern match
 */
export function validatePattern(
  value: string | null | undefined,
  fieldName: string,
  pattern: RegExp
): ValidationError[] {
  if (value && !pattern.test(value)) {
    return [{ field: fieldName, message: VALIDATION_MESSAGES.PATTERN_MISMATCH(fieldName) }]
  }
  return []
}

/**
 * Create a custom validator
 */
export function createValidator(fn: (value: unknown) => ValidationError[]): (value: unknown) => ValidationError[] {
  return fn
}

/**
 * Combine multiple validators
 */
export function combineValidators(
  ...validators: Array<(value: unknown) => ValidationError[]>
): (value: unknown) => ValidationError[] {
  return (value) => {
    return validators.flatMap(validator => validator(value))
  }
}

/**
 * Validate a form object with field-specific validators
 */
export function validateForm<T extends Record<string, unknown>>(
  formData: T,
  validators: Partial<Record<keyof T, (value: unknown) => ValidationError[]>>
): ValidationResult {
  const errors: ValidationError[] = []

  for (const [field, validator] of Object.entries(validators)) {
    if (validator) {
      const fieldErrors = validator(formData[field as keyof T])
      errors.push(...fieldErrors)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate create user form
 */
export function validateCreateUserForm(data: {
  email: string
  firstName: string
  lastName: string
}): ValidationResult {
  const errors: ValidationError[] = []

  errors.push(...validateEmail(data.email))
  errors.push(...validateRequired(data.firstName, 'First name'))
  errors.push(...validateRequired(data.lastName, 'Last name'))

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate create/edit job form fields
 */
export function validateJobForm(data: {
  name: string
  code?: string | null
  accountNumber?: string | null
  startDate?: string | null
  finishDate?: string | null
  productionBurden?: string | number | null
}): ValidationResult {
  const errors: ValidationError[] = []

  errors.push(...validateRequired(data.name, 'Job name'))

  const code = String(data.code ?? '').trim()
  const accountNumber = String(data.accountNumber ?? '').trim()
  const startDate = String(data.startDate ?? '').trim()
  const finishDate = String(data.finishDate ?? '').trim()

  if (accountNumber && !/^\d{4}$/.test(accountNumber)) {
    errors.push({
      field: 'accountNumber',
      message: 'Account number must be exactly 4 digits',
    })
  }

  const isGlCode = /^\d{3}$/.test(code)
  if (isGlCode && accountNumber) {
    errors.push({
      field: 'accountNumber',
      message: 'Account number must be blank when using a 3-digit GL code',
    })
  }

  if (startDate && finishDate && finishDate < startDate) {
    errors.push({
      field: 'finishDate',
      message: 'Finish date cannot be earlier than start date',
    })
  }

  const productionBurdenRaw = String(data.productionBurden ?? '').trim()
  if (productionBurdenRaw) {
    const burden = Number(productionBurdenRaw)
    if (!Number.isFinite(burden) || Number.isNaN(burden) || burden < 0) {
      errors.push({
        field: 'productionBurden',
        message: 'Burden must be a non-negative number',
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate login form fields
 */
export function validateLoginForm(data: {
  email: string
  password: string
}): ValidationResult {
  const errors: ValidationError[] = []

  errors.push(...validateEmail(data.email))
  errors.push(...validateRequired(data.password, 'Password'))

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate signup form fields
 */
export function validateSignUpForm(data: {
  email: string
  password: string
  confirmPassword: string
}): ValidationResult {
  const errors: ValidationError[] = []

  errors.push(...validateEmail(data.email))
  errors.push(...validateRequired(data.password, 'Password'))
  errors.push(...validateMinLength(data.password, 'Password', 6))
  errors.push(...validateRequired(data.confirmPassword, 'Confirm password'))

  if (data.password && data.confirmPassword && data.password !== data.confirmPassword) {
    errors.push({ field: 'confirmPassword', message: 'Passwords do not match' })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Get first validation error message
 */
export function getFirstValidationMessage(result: ValidationResult): string | null {
  return result.errors[0]?.message ?? null
}

/**
 * Get error message for a specific field
 */
export function getFieldError(errors: ValidationError[], fieldName: string): string | null {
  const error = errors.find(e => e.field === fieldName)
  return error?.message ?? null
}
