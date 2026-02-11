# App Standardization Implementation Guide

## Overview

This document outlines the standardization applied to all tables and forms across the Phase 2 application to ensure consistency and improve user experience.

## What's Been Standardized

### 1. Table Structure & Styling
All data tables now follow a consistent pattern:

**Common Classes:**
- `.table` - Base table class
- `.table-sm` - Compact sizing
- `.table-striped` - Alternating row colors
- `.table-hover` - Row hover effect
- `.table-responsive` - Wrapper for horizontal scroll

**Consistent Styling:**
- Border: `1px solid #dee2e6`
- Border radius: `4px`
- Header background: `#f0f0f0`
- Header border: `2px solid #dee2e6`
- Row borders: `1px solid #dee2e6`
- Cell padding: `8px`

### 2. Input Fields in Tables
All editable inputs follow these standards:

**Text/Number Inputs:**
```html
<input 
  type="text" (or "number")
  class="form-control form-control-sm" 
  placeholder="Enter value"
  @focus="($event.target as HTMLInputElement).select()"
  v-model="value"
  :disabled="!canEdit"
/>
```

**Features:**
- Auto-select text on focus for easy replacement
- Centered text for numbers
- Consistent sizing (`form-control-sm`)
- Disabled state when not editable
- Placeholder text for guidance

### 3. Action Buttons in Tables
Consistent button styling across all tables:

**Delete Button:**
```html
<button 
  class="btn btn-outline-danger btn-sm"
  @click="deleteRow(idx)"
  title="Delete row"
>
  <i class="bi bi-trash"></i>
</button>
```

**Add Button (below table):**
```html
<button 
  class="btn btn-outline-primary btn-sm mt-2"
  @click="addRow"
>
  <i class="bi bi-plus-lg me-1"></i>Add Row
</button>
```

### 4. Column Headers
All table headers now have:
- Class: `class="small fw-semibold"`
- Explicit widths for all columns
- Centered action column with `text-center`

### 5. Data Tables Applied

The following views have been standardized:

1. **Daily Logs** - Manpower section
   - Editable Trade/Count/Areas
   - Delete buttons on each row
   - Add trade button below

2. **Shop Orders** - Order Items section
   - Now editable when order is draft
   - Consistent styling with other tables
   - Same delete/add patterns

3. **Admin Employees** - Roster tables
   - Consistent header styling
   - Add button styling
   - Improved spacing

## How to Use the Standards

### For Existing Components

If you need to update a table, follow this template:

```vue
<div class="table-responsive" style="border: 1px solid #dee2e6; border-radius: 4px;">
  <table class="table table-sm table-striped table-hover mb-0">
    <!-- Header -->
    <thead class="table-light" style="background-color: #f0f0f0;">
      <tr style="border-bottom: 2px solid #dee2e6;">
        <th style="width: 40%;" class="small fw-semibold">Column Name</th>
        <th style="width: 60%;" class="small fw-semibold">Column Name</th>
        <th style="width: 80px;" class="small fw-semibold text-center">Actions</th>
      </tr>
    </thead>
    
    <!-- Body -->
    <tbody>
      <tr v-for="(row, idx) in rows" :key="idx" style="border-bottom: 1px solid #dee2e6;">
        <td style="padding: 8px;">
          <input 
            type="text"
            class="form-control form-control-sm"
            v-model="row.field1"
            @focus="($event.target as HTMLInputElement).select()"
            :disabled="!canEdit"
          />
        </td>
        <td style="padding: 8px;">
          <input 
            type="number"
            class="form-control form-control-sm text-center"
            v-model.number="row.field2"
            @focus="($event.target as HTMLInputElement).select()"
            :disabled="!canEdit"
          />
        </td>
        <td style="padding: 8px;" class="text-center">
          <button 
            v-if="canDelete"
            class="btn btn-outline-danger btn-sm"
            @click="deleteRow(idx)"
            title="Delete this row"
          >
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</div>

<!-- Add Button -->
<button 
  v-if="canEdit"
  type="button"
  class="btn btn-outline-primary btn-sm mt-2"
  @click="addRow"
>
  <i class="bi bi-plus-lg me-1"></i>Add Row
</button>
```

### For New Components

Use the `DataTable.vue` component for rapid development:

```vue
<script setup lang="ts">
import DataTable from '@/components/DataTable.vue'

const rows = ref([
  { id: 1, name: 'Item 1', value: 100 },
  { id: 2, name: 'Item 2', value: 200 }
])

const columns = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'value', label: 'Value', type: 'number', width: '100px' }
]

const handleAddRow = () => {
  rows.value.push({ id: Date.now(), name: '', value: 0 })
}

const handleDeleteRow = (index: number) => {
  rows.value.splice(index, 1)
}

const handleUpdateRow = (index: number, updated: any) => {
  rows.value[index] = updated
}
</script>

<template>
  <DataTable
    :rows="rows"
    :columns="columns"
    editable
    @onAddRow="handleAddRow"
    @onDeleteRow="handleDeleteRow"
    @onUpdateRow="handleUpdateRow"
  />
</template>
```

## Key Features

### 1. **Consistency**
All tables use the same visual language and interaction patterns:
- Same colors and borders
- Same button styling and icons
- Same input behavior (auto-select on focus)

### 2. **Accessibility**
- All buttons have `title` attributes for tooltips
- Buttons have clear visual indicators (color, icon)
- Disabled state is clearly visible
- Keyboard navigation works

### 3. **Responsiveness**
- Tables wrapped in `table-responsive` for mobile
- Font sizes adjusted with Bootstrap utilities
- Column widths explicitly set
- Compact sizing on mobile displays

### 4. **User Experience**
- Number fields auto-select on focus for quick replacement
- Confirmation dialogs for destructive actions
- Clear visual feedback for disabled states
- Toast notifications for actions

## Files Modified

### Views Updated
- `src/views/DailyLogs.vue` - Manpower table
- `src/views/ShopOrders.vue` - Order Items table
- `src/views/admin/AdminEmployees.vue` - Roster tables

### New Components Created
- `src/components/DataTable.vue` - Reusable table component
- `src/utils/tableStandards.ts` - Standard classes and utilities
- `src/utils/STANDARDIZATION_GUIDE.ts` - Guidelines and checklist
- `src/utils/APP_STANDARDIZATION.ts` - Implementation details

## Guidelines for Future Development

### When Creating a New Table:

1. ✅ Use the standard table wrapper with border and radius
2. ✅ Apply consistent classes: `table table-sm table-striped table-hover`
3. ✅ Style headers with gray background and bold text
4. ✅ Add borders to all rows and the table wrapper
5. ✅ Include explicit column widths
6. ✅ Use `form-control-sm` for all inputs
7. ✅ Add `@focus` handlers for text/number inputs
8. ✅ Include `title` attributes on all buttons
9. ✅ Wrap table in `table-responsive` div
10. ✅ Place Add button below table with proper spacing

### Button Standards:
- **Primary actions**: `btn btn-primary btn-sm`
- **Secondary actions**: `btn btn-outline-secondary btn-sm`
- **Delete actions**: `btn btn-outline-danger btn-sm`
- **Add actions**: `btn btn-outline-primary btn-sm`

### Input Standards:
- Always: `form-control form-control-sm`
- Number fields: add `text-center`
- All with: `@focus="($event.target as HTMLInputElement).select()"`
- All with: `:disabled="!canEdit"` or similar condition

## Testing the Standards

When verifying tables work correctly:

- [ ] Headers display correctly with bold text
- [ ] Rows have bottom borders
- [ ] Inputs are editable when enabled
- [ ] Delete buttons appear only when appropriate
- [ ] Add button is below table
- [ ] Number inputs auto-select on focus
- [ ] Disabled state is visually clear
- [ ] Table is responsive on mobile
- [ ] All buttons have hover effects
- [ ] Confirmation appears on delete

## Questions or Issues?

Refer to the standardization documents:
- `src/utils/tableStandards.ts` - Standard utilities
- `src/utils/STANDARDIZATION_GUIDE.ts` - Implementation guide
- `src/utils/APP_STANDARDIZATION.ts` - Complete reference

