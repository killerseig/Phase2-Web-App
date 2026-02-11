/**
 * APP-WIDE STANDARDIZATION CHECKLIST
 * 
 * Use this checklist when creating or refactoring any component with tables or forms.
 */

// ============================================================================
// TABLE CHECKLIST
// ============================================================================

const TABLE_CHECKLIST = {
  structure: [
    '☐ Table wrapped in <div class="table-responsive">',
    '☐ Table has border: 1px solid #dee2e6; border-radius: 4px;',
    '☐ Classes: table table-sm table-striped table-hover mb-0',
    '☐ Header: class="table-light" with background-color: #f0f0f0;',
    '☐ Header row: style="border-bottom: 2px solid #dee2e6;"',
    '☐ Header cells: class="small fw-semibold"',
    '☐ Body rows: style="border-bottom: 1px solid #dee2e6;"',
    '☐ Body cells: style="padding: 8px;"'
  ],
  
  columns: [
    '☐ First column: auto width (no style)',
    '☐ Width specified for narrow columns (e.g., style="width: 100px;")',
    '☐ Last column (Actions): style="width: 80px;" class="text-center"',
    '☐ Number columns: class="text-center"',
    '☐ All column headers have explicit widths or are marked as auto'
  ],
  
  inputs: [
    '☐ All inputs: class="form-control form-control-sm"',
    '☐ All inputs: @focus="($event.target as HTMLInputElement).select()"',
    '☐ All inputs have placeholder text',
    '☐ Number inputs: type="number" with min/max/step as needed',
    '☐ Number inputs: class="text-center"',
    '☐ All inputs: :disabled="!canEdit" (or appropriate condition)',
    '☐ All inputs have title attribute for tooltips'
  ],
  
  buttons: [
    '☐ Delete button: class="btn btn-outline-danger btn-sm" with icon',
    '☐ All buttons: title attribute for tooltips',
    '☐ Button container: class="d-flex gap-1" for multiple actions',
    '☐ Add button separate from table with: class="btn btn-outline-primary btn-sm mt-2"',
    '☐ Add button has icon: <i class="bi bi-plus-lg me-1"></i>',
    '☐ All action buttons: @click handlers are bound'
  ],
  
  rows: [
    '☐ Delete button appears only when canEdit/canDelete is true',
    '☐ First row cannot be deleted (if needed)',
    '☐ Rows can be added via separate button',
    '☐ Row deletion has confirmation dialog',
    '☐ Add row creates new empty row with defaults'
  ]
}

// ============================================================================
// FORM CHECKLIST
// ============================================================================

const FORM_CHECKLIST = {
  layout: [
    '☐ Form wrapped in card with .card class',
    '☐ Form title in .card-header or above form',
    '☐ Form fields in .card-body',
    '☐ Form actions in .card-footer or below',
    '☐ Use .row and .col-* for responsive layout',
    '☐ Consistent spacing: g-3 for row gaps'
  ],
  
  fields: [
    '☐ All fields have <label class="form-label">',
    '☐ All inputs have consistent class patterns',
    '☐ Required fields marked with asterisk or (Required)',
    '☐ Help text shown with .form-text small muted',
    '☐ Error messages shown inline near field',
    '☐ Disabled state applies to all related inputs'
  ],
  
  validation: [
    '☐ Client-side validation before submit',
    '☐ Error messages are clear and actionable',
    '☐ Errors shown as alert-danger above form',
    '☐ Save button disabled if validation fails',
    '☐ Error dismissal via btn-close',
    '☐ Form fields highlighted on error'
  ],
  
  buttons: [
    '☐ Primary action: class="btn btn-primary"',
    '☐ Secondary action: class="btn btn-secondary"',
    '☐ Cancel: class="btn btn-outline-secondary"',
    '☐ Delete: class="btn btn-danger"',
    '☐ All buttons: :disabled="loading"',
    '☐ Loading text shown: "Saving..." etc'
  ],
  
  states: [
    '☐ Normal state: all inputs enabled',
    '☐ Loading state: buttons disabled, spinner shown',
    '☐ Submitted state: form disabled, message shown',
    '☐ Error state: alert shown, inputs enabled for retry',
    '☐ Success state: message shown, form reset or closed'
  ]
}

// ============================================================================
// COLOR & STYLING PALETTE
// ============================================================================

const STYLE_PALETTE = {
  borders: {
    default: '#dee2e6',    // Bootstrap gray-300
    light: '#e9ecef',      // Bootstrap gray-200
    dark: '#adb5bd'        // Bootstrap gray-600
  },
  
  backgrounds: {
    header: '#f0f0f0',     // Light gray for table headers
    disabled: '#f0f0f0',   // Disabled input background
    hover: 'auto',         // Bootstrap table-hover handles this
    active: '#e9ecef'      // Light background for active rows
  },
  
  text: {
    normal: '#212529',     // Bootstrap body text
    muted: '#6c757d',      // Bootstrap text-muted
    disabled: '#666',      // Disabled text
    light: '#999'          // Very light text
  },
  
  buttons: {
    primary: '#0d6efd',    // Bootstrap primary
    danger: '#dc3545',     // Bootstrap danger
    success: '#198754',    // Bootstrap success
    warning: '#ffc107',    // Bootstrap warning
    info: '#0dcaf0'        // Bootstrap info
  }
}

// ============================================================================
// BOOTSTRAP INTEGRATION
// ============================================================================

/**
 * Standard Bootstrap Classes Used:
 * 
 * Layout:
 * - .container-fluid, .container
 * - .row, .col-*, .col-md-*, .col-lg-*
 * - .g-3 (gap for rows)
 * - .mb-*, .mt-*, .ms-*, .me-*, .p-*
 * - .d-flex, .justify-content-*, .align-items-*
 * - .gap-*
 * 
 * Forms:
 * - .form-label, .form-text
 * - .form-control, .form-control-sm
 * - .form-check, .form-check-input, .form-check-label
 * - .form-select, .form-select-sm
 * 
 * Tables:
 * - .table, .table-sm, .table-striped, .table-hover, .table-light
 * - .table-responsive
 * - .text-center, .text-start, .text-end
 * - .fw-semibold, .fw-bold
 * - .small
 * 
 * Buttons:
 * - .btn, .btn-sm, .btn-primary, .btn-outline-primary
 * - .btn-danger, .btn-outline-danger
 * - .btn-success, .btn-info, .btn-warning
 * - .d-grid (for full-width buttons)
 * 
 * Cards:
 * - .card, .card-header, .card-body, .card-footer
 * 
 * Alerts:
 * - .alert, .alert-*, .alert-dismissible, .btn-close
 * 
 * Badges:
 * - .badge, .text-bg-*
 * 
 * Others:
 * - .spinner-border, .spinner-border-sm
 * - .text-muted
 * - .ms-auto (margin-start auto, push to right)
 */

// ============================================================================
// COMMON PATTERNS
// ============================================================================

/**
 * Pattern 1: Editable Table Row
 * 
 * Features:
 * - Inline editing of all fields
 * - Auto-save or manual save
 * - Delete button on each row
 * - Add new row button below table
 * 
 * Example: DailyLogs Manpower section, ShopOrders items
 */

/**
 * Pattern 2: Display Table with Bulk Actions
 * 
 * Features:
 * - Display data in rows
 * - Individual row actions (View, Edit, Delete)
 * - Bulk actions (Select all, Delete selected)
 * - Search/filter above table
 * 
 * Example: Admin Employee Roster, User Management
 */

/**
 * Pattern 3: Accordion with Nested Table
 * 
 * Features:
 * - Collapsible sections with content
 * - Table or list inside each section
 * - Per-section actions
 * 
 * Example: Timecards (one accordion per employee)
 */

/**
 * Pattern 4: Modal with Table Selection
 * 
 * Features:
 * - Modal dialog with table
 * - Select items from table to add
 * - Confirmation button
 * - Cancel button
 * 
 * Example: Add employees to roster
 */

// ============================================================================
// ICON STANDARDS
// ============================================================================

const ICONS = {
  actions: {
    add: 'bi bi-plus-lg',           // Add item
    delete: 'bi bi-trash',          // Delete item
    edit: 'bi bi-pencil',           // Edit item
    save: 'bi bi-check-circle',     // Save changes
    cancel: 'bi bi-x-circle',       // Cancel action
    view: 'bi bi-eye',              // View details
    download: 'bi bi-download',     // Download
    upload: 'bi bi-upload'          // Upload
  },
  
  status: {
    success: 'bi bi-check-circle',  // Success/active
    error: 'bi bi-x-circle',        // Error/failed
    warning: 'bi bi-exclamation-triangle',
    info: 'bi bi-info-circle',
    pending: 'bi bi-hourglass-split'
  },
  
  navigation: {
    menu: 'bi bi-list',             // Menu
    back: 'bi bi-arrow-left',       // Back
    next: 'bi bi-arrow-right',      // Next
    home: 'bi bi-house'             // Home
  }
}

// ============================================================================
// SPACING STANDARDS
// ============================================================================

const SPACING = {
  table: {
    cellPadding: '8px',
    rowGap: '1px',
    wrapperGap: '16px'
  },
  
  form: {
    fieldGap: '12px',               // g-3 in Bootstrap
    sectionGap: '20px',
    verticalPadding: '16px'
  },
  
  buttons: {
    gap: '8px',                     // Between multiple buttons
    marginTop: '12px'               // Above button row
  }
}

// ============================================================================
// RESPONSIVE CONSIDERATIONS
// ============================================================================

/**
 * Mobile (< 768px):
 * - Hide non-essential columns in tables
 * - Stack form fields
 * - Use full-width buttons
 * - Increase tap target size for buttons (min 44px)
 * - Stack multiple buttons vertically
 * 
 * Tablet (768px - 1024px):
 * - Show most columns
 * - Use 2-column layouts
 * - Horizontal button layout if space allows
 * 
 * Desktop (> 1024px):
 * - Show all columns
 * - Multi-column layouts
 * - Inline button groups
 */

// ============================================================================
// TESTING CHECKLIST
// ============================================================================

const TESTING_CHECKLIST = [
  '☐ Add row works correctly',
  '☐ Edit/delete buttons appear when appropriate',
  '☐ Delete shows confirmation',
  '☐ Can edit all fields',
  '☐ Changes are persisted',
  '☐ Validation prevents invalid saves',
  '☐ Error messages are clear',
  '☐ Loading states work',
  '☐ Disabled state is obvious',
  '☐ Mobile layout is readable',
  '☐ Keyboard navigation works',
  '☐ Buttons have hover effects'
]

export { TABLE_CHECKLIST, FORM_CHECKLIST, STYLE_PALETTE, ICONS, SPACING, TESTING_CHECKLIST }
