/**
 * Table Standards & Utilities
 * Provides consistent patterns for all table operations across the app
 */

/**
 * Standard table classes
 */
export const TABLE_CLASSES = {
  base: 'table table-sm table-striped table-hover mb-0',
  header: 'table-light',
  headerRow: 'bg-light',
  headerCell: 'small fw-semibold',
  bodyRow: 'border-bottom',
  bodyCell: '',
  input: 'form-control form-control-sm text-center',
  button: {
    delete: 'btn btn-outline-danger btn-sm',
    add: 'btn btn-outline-primary btn-sm',
    edit: 'btn btn-outline-secondary btn-sm',
    submit: 'btn btn-primary btn-sm',
    cancel: 'btn btn-secondary btn-sm'
  }
}

/**
 * Standard messages
 */
export const TABLE_MESSAGES = {
  deleteConfirm: 'Are you sure you want to delete this row?',
  deleteConfirmItem: (name?: string) => `Are you sure you want to delete ${name || 'this item'}?`,
  empty: 'No data available',
  noResults: 'No results found',
  unsavedChanges: 'You have unsaved changes. Do you want to discard them?',
  saveSuccess: 'Changes saved successfully',
  saveFailed: 'Failed to save changes',
  deleteSuccess: 'Item deleted successfully',
  deleteFailed: 'Failed to delete item',
  addSuccess: 'Item added successfully',
  addFailed: 'Failed to add item'
}

/**
 * Standard validation rules
 */
export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'min' | 'max' | 'email' | 'custom'
  value?: any
  message: string
}

export function validateCell(value: any, rules: ValidationRule[]): string | null {
  for (const rule of rules) {
    switch (rule.type) {
      case 'required':
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          return rule.message
        }
        break
      case 'minLength':
        if (typeof value === 'string' && value.length < rule.value) {
          return rule.message
        }
        break
      case 'maxLength':
        if (typeof value === 'string' && value.length > rule.value) {
          return rule.message
        }
        break
      case 'min':
        if (typeof value === 'number' && value < rule.value) {
          return rule.message
        }
        break
      case 'max':
        if (typeof value === 'number' && value > rule.value) {
          return rule.message
        }
        break
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return rule.message
        }
        break
      case 'custom':
        if (rule.value && !rule.value(value)) {
          return rule.message
        }
        break
    }
  }
  return null
}

/**
 * Standard row operations
 */
export function createEmptyRow<T extends Record<string, any>>(template: T): T {
  const row: any = {}
  for (const key in template) {
    row[key] = typeof template[key] === 'number' ? 0 : ''
  }
  return row as T
}

export function cloneRow<T extends Record<string, any>>(row: T): T {
  return JSON.parse(JSON.stringify(row))
}

export function mergeRowUpdates<T extends Record<string, any>>(original: T, updates: Partial<T>): T {
  return { ...original, ...updates }
}

/**
 * Standard styling helper
 */
export function getTableClasses(options: {
  striped?: boolean
  hover?: boolean
  compact?: boolean
  bordered?: boolean
} = {}): string {
  const classes = ['table', 'table-sm', 'mb-0']
  if (options.striped !== false) classes.push('table-striped')
  if (options.hover !== false) classes.push('table-hover')
  if (options.bordered) classes.push('table-bordered')
  return classes.join(' ')
}

/**
 * Standard column width helpers
 */
export const COLUMN_WIDTHS = {
  xs: '40px',
  sm: '80px',
  md: '120px',
  lg: '200px',
  xl: '300px',
  actions: '80px',
  checkbox: '40px'
}

/**
 * Standard input types for tables
 */
export type TableInputType = 'text' | 'number' | 'email' | 'date' | 'select' | 'textarea' | 'checkbox'

/**
 * Format values for display
 */
export function formatCellValue(value: any, type: 'currency' | 'percent' | 'date' | 'time' | 'default' = 'default'): string {
  if (value === null || value === undefined) return '-'
  
  switch (type) {
    case 'currency':
      return `$${Number(value).toFixed(2)}`
    case 'percent':
      return `${Number(value).toFixed(1)}%`
    case 'date':
      return new Date(value).toLocaleDateString()
    case 'time':
      return new Date(value).toLocaleTimeString()
    default:
      return String(value)
  }
}
