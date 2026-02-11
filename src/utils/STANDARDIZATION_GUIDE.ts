/**
 * FORM & TABLE STANDARDIZATION GUIDELINES
 * 
 * This document establishes consistent patterns for all forms and tables in the Phase 2 app.
 * All new and refactored components should follow these standards.
 */

// ============================================================================
// TABLE STANDARDS
// ============================================================================

/**
 * Standard Table Structure:
 * 
 * <div class="table-responsive" style="border: 1px solid #dee2e6; border-radius: 4px;">
 *   <table class="table table-sm table-striped table-hover mb-0">
 *     <thead class="table-light" style="background-color: #f0f0f0;">
 *       <tr style="border-bottom: 2px solid #dee2e6;">
 *         <th style="width: 40%;" class="small fw-semibold">Column Name</th>
 *         <th style="width: 60%;" class="small fw-semibold">Column Name</th>
 *         <th style="width: 80px;" class="text-center">Actions</th>
 *       </tr>
 *     </thead>
 *     <tbody>
 *       <tr v-for="(row, idx) in rows" :key="idx" style="border-bottom: 1px solid #dee2e6;">
 *         <td style="padding: 8px;">
 *           <input class="form-control form-control-sm" v-model="row.field1" />
 *         </td>
 *         <td style="padding: 8px;">
 *           <input class="form-control form-control-sm" v-model="row.field2" />
 *         </td>
 *         <td style="padding: 8px;" class="text-center">
 *           <button class="btn btn-outline-danger btn-sm" @click="deleteRow(idx)">
 *             <i class="bi bi-trash"></i>
 *           </button>
 *         </td>
 *       </tr>
 *     </tbody>
 *   </table>
 * </div>
 * <button class="btn btn-outline-primary btn-sm mt-2" @click="addRow">
 *   <i class="bi bi-plus-lg me-1"></i>Add Row
 * </button>
 */

// ============================================================================
// INPUT STANDARDIZATION
// ============================================================================

/**
 * All inputs should include:
 * 1. Auto-select on focus for number/text fields
 * 2. Consistent size (form-control-sm for tables)
 * 3. Placeholder text for clarity
 * 4. Disabled state when appropriate
 * 5. Title attribute for tooltips
 * 
 * Examples:
 */

// Text Input
/*
<input 
  type="text"
  class="form-control form-control-sm" 
  placeholder="Enter value"
  v-model="value"
  @focus="($event.target as HTMLInputElement).select()"
  :disabled="!canEdit"
  title="Description of this field"
/>
*/

// Number Input
/*
<input 
  type="number"
  min="0"
  step="0.25"
  class="form-control form-control-sm text-center" 
  placeholder="0"
  v-model.number="value"
  @focus="($event.target as HTMLInputElement).select()"
  :disabled="!canEdit"
/>
*/

// Select
/*
<select 
  class="form-control form-control-sm"
  v-model="value"
  :disabled="!canEdit"
>
  <option value="">Select...</option>
  <option v-for="opt in options" :key="opt.value" :value="opt.value">
    {{ opt.label }}
  </option>
</select>
*/

// Textarea
/*
<textarea 
  class="form-control form-control-sm"
  placeholder="Enter text..."
  v-model="value"
  rows="3"
  :disabled="!canEdit"
></textarea>
*/

// ============================================================================
// BUTTON STANDARDIZATION
// ============================================================================

/**
 * Standard Button Classes:
 */
export const BUTTON_CLASSES = {
  primary: 'btn btn-primary btn-sm',           // Main actions (Save, Submit)
  secondary: 'btn btn-secondary btn-sm',       // Alternative actions
  success: 'btn btn-success btn-sm',           // Positive actions (Approve, Confirm)
  danger: 'btn btn-danger btn-sm',             // Destructive actions (Delete)
  warning: 'btn btn-warning btn-sm',           // Caution actions
  info: 'btn btn-info btn-sm',                 // Informational
  
  // Outline versions for secondary importance
  outlinePrimary: 'btn btn-outline-primary btn-sm',
  outlineSecondary: 'btn btn-outline-secondary btn-sm',
  outlineDanger: 'btn btn-outline-danger btn-sm',
  
  // Icon-only (for dense tables)
  iconOnly: 'btn btn-sm p-1',
  
  // Full width (for modals/forms)
  fullWidth: 'btn btn-primary btn-sm w-100',
}

/**
 * Standard Button Structure in Tables:
 * 
 * Single Action (Edit/Delete):
 * <button class="btn btn-outline-danger btn-sm" @click="deleteRow(idx)" title="Delete this row">
 *   <i class="bi bi-trash"></i>
 * </button>
 * 
 * Multiple Actions:
 * <div class="d-flex gap-1">
 *   <button class="btn btn-outline-primary btn-sm" @click="editRow(idx)" title="Edit">
 *     <i class="bi bi-pencil"></i>
 *   </button>
 *   <button class="btn btn-outline-danger btn-sm" @click="deleteRow(idx)" title="Delete">
 *     <i class="bi bi-trash"></i>
 *   </button>
 * </div>
 */

// ============================================================================
// VALIDATION STANDARDIZATION
// ============================================================================

/**
 * All inputs should validate before save:
 * 
 * 1. Check required fields
 * 2. Validate data types (numbers in number fields)
 * 3. Check constraints (min/max)
 * 4. Show error messages in consistent format
 * 5. Disable save button until valid
 */

// ============================================================================
// DISABLED/READONLY STATE STANDARDIZATION
// ============================================================================

/**
 * When a form/table is in view-only mode:
 * 1. All inputs should have :disabled="true"
 * 2. Delete/Add buttons should be hidden or disabled
 * 3. Background color should be #f0f0f0 for disabled inputs
 * 4. Text should be slightly grayed (#666)
 * 5. Cursor should be "not-allowed"
 * 
 * This is already handled by .form-control:disabled styling
 */

// ============================================================================
// ERROR MESSAGE STANDARDIZATION
// ============================================================================

/**
 * Error messages should be:
 * 1. Brief and actionable
 * 2. Shown in alert-danger red
 * 3. Appear above the form
 * 4. Have a dismiss button
 * 5. Persist until manually closed or form succeeds
 * 
 * Example:
 */

/*
<div v-if="error" class="alert alert-danger alert-dismissible fade show">
  <strong>Error:</strong> {{ error }}
  <button type="button" class="btn-close" @click="error = ''"></button>
</div>
*/

// ============================================================================
// LOADING STATE STANDARDIZATION
// ============================================================================

/**
 * When loading or saving:
 * 1. Show spinner or "Loading..." text
 * 2. Disable all interactive elements
 * 3. Disable buttons with :disabled="loading"
 * 4. Show "Saving..." text on button
 * 5. Don't allow navigation away
 * 
 * Example:
 */

/*
<button 
  @click="save" 
  :disabled="loading"
  class="btn btn-primary"
>
  <i v-if="loading" class="bi bi-hourglass-split me-1"></i>
  {{ loading ? 'Saving...' : 'Save' }}
</button>
*/

// ============================================================================
// TOAST/NOTIFICATION STANDARDIZATION
// ============================================================================

/**
 * Use the Toast component for all user feedback:
 * 
 * toastRef.value?.show('Message text', 'success')  // Green
 * toastRef.value?.show('Message text', 'error')    // Red
 * toastRef.value?.show('Message text', 'warning')  // Orange
 * toastRef.value?.show('Message text', 'info')     // Blue
 * 
 * Use for:
 * - Save/Delete success messages
 * - Quick validation errors
 * - Action confirmations
 * 
 * Use alert for:
 * - Form validation errors (before save)
 * - Blocking errors that need attention
 * - Error details
 */

// ============================================================================
// RESPONSIVE STANDARDIZATION
// ============================================================================

/**
 * All tables should be:
 * 1. Wrapped in <div class="table-responsive">
 * 2. Scrollable horizontally on small screens
 * 3. Readable on mobile (consider hiding non-essential columns)
 * 4. Use Bootstrap grid for stacked views if needed
 */

// ============================================================================
// COLOR & STYLING STANDARDIZATION
// ============================================================================

export const TABLE_COLORS = {
  border: '#dee2e6',           // Bootstrap default
  headerBg: '#f0f0f0',         // Light gray
  headerBorder: '#dee2e6',     // Standard border
  rowBorder: '#dee2e6',        // Row separator
  hoverBg: '#f5f5f5',          // Bootstrap hover (automatic with table-hover)
  disabledBg: '#f0f0f0',       // Disabled input background
  disabledText: '#666',        // Disabled text color
}

export const TABLE_STYLES = {
  wrapper: 'border: 1px solid #dee2e6; border-radius: 4px;',
  header: 'background-color: #f0f0f0; border-bottom: 2px solid #dee2e6;',
  row: 'border-bottom: 1px solid #dee2e6;',
  cellPadding: 'padding: 8px;',
  headerCell: 'small fw-semibold',
}
