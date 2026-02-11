# SASS/SCSS Usage Guide

Quick reference for using the new SCSS system in your app.

---

## Quick Start

### Import Variables & Mixins in Any Style Block

```vue
<style scoped lang="scss">
@import '@/styles/variables';
@import '@/styles/mixins';

.my-component {
  padding: $spacing-md;
  color: $text-color-dark;
  border-radius: $border-radius-md;
}
</style>
```

---

## Design Variables

### Colors

```scss
// Brand
$color-primary      // #646cff
$color-primary-hover // #535bf2

// Neutral
$color-dark         // #242424
$color-light        // #ffffff
$color-gray-light   // #e0e0e0

// Semantic
$color-success      // #28a745
$color-warning      // #ffc107
$color-danger       // #dc3545
```

### Spacing

```scss
$spacing-xs   // 0.25rem
$spacing-sm   // 0.5rem
$spacing-md   // 1rem (default)
$spacing-lg   // 1.5rem
$spacing-xl   // 2rem
$spacing-2xl  // 2.5rem
```

### Typography

```scss
$font-family-base   // system-ui, Avenir, etc.
$font-size-base     // 1rem
$font-size-lg       // 1.125rem
$font-size-xl       // 1.25rem
$font-weight-normal // 400
$font-weight-bold   // 700
$line-height-normal // 1.5
```

### Other

```scss
$border-radius-md   // 8px
$shadow-md          // elevation shadow
$transition-normal  // 0.25s ease-in-out
```

---

## Mixins (Reusable Patterns)

### Responsive Design

```scss
.mobile-menu {
  display: none;
  
  @include respond-to('md') {
    display: block;
  }
}

// Options: 'xs', 'sm', 'md', 'lg', 'xl', '2xl'
```

### Flexbox

```scss
.header {
  @include flex-between;  // flex, center, space-between
}

.centered {
  @include flex-center;   // flex, center, center
}

.column {
  @include flex-column;   // flex-direction: column
}
```

### Text

```scss
.truncated {
  @include text-truncate; // Single line ellipsis
}

.clamped {
  @include text-clamp(3); // Clamp to 3 lines
}

.link {
  @include text-underline-hover; // Underline on hover
}
```

### Buttons

```scss
.my-button {
  @include button-base;   // Base button styles
  background: $color-success;
}

.primary-button {
  @include button-primary; // Pre-styled primary button
}
```

### Shadows

```scss
.card {
  @include shadow-card;    // Box shadow
  
  &:hover {
    @include shadow-hover; // Larger shadow on hover
  }
}
```

### Transitions

```scss
.element {
  @include transition(all, $transition-slow);
  
  &:hover {
    transform: scale(1.05);
  }
}
```

### Borders

```scss
.box {
  @include border-all($border-width, $color-primary);
  @include border-top(2px, $color-danger);
  @include border-bottom(1px, $color-gray-light);
}
```

### Focus Rings (Accessibility)

```scss
button {
  @include focus-visible; // Adds focus ring on keyboard focus
}
```

### Positioning

```scss
.modal {
  @include absolute-center; // Center absolutely
  width: 400px;
  height: 300px;
}

.overlay {
  @include fixed-cover; // Cover entire viewport
  background: rgba(0, 0, 0, 0.5);
}
```

---

## Component Example

Here's a complete component with SCSS:

```vue
<template>
  <div class="card-component">
    <h2 class="title">{{ title }}</h2>
    <p class="description">{{ description }}</p>
    <button class="btn-primary">Click Me</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description: string
}>()
</script>

<style scoped lang="scss">
@import '@/styles/variables';
@import '@/styles/mixins';

.card-component {
  padding: $spacing-lg;
  background: $bg-color-light;
  border-radius: $border-radius-lg;
  @include shadow-card;
  @include transition(all, $transition-normal);

  &:hover {
    @include shadow-hover;
    transform: translateY(-4px);
  }
}

.title {
  font-size: $font-size-2xl;
  @include font-heading;
  margin-bottom: $spacing-md;
  color: $color-primary;
}

.description {
  font-size: $font-size-base;
  color: $text-color-light;
  margin-bottom: $spacing-lg;
  @include text-clamp(2);
}

.btn-primary {
  @include button-primary;
  margin-top: $spacing-md;
}

// Responsive
@include respond-to('md') {
  .card-component {
    padding: $spacing-md;
  }

  .title {
    font-size: $font-size-xl;
  }
}
```

---

## Common Patterns

### Responsive Grid

```scss
.grid {
  @include grid-cols(3);
  
  @include respond-to('md') {
    @include grid-cols(2);
  }
  
  @include respond-to('sm') {
    @include grid-cols(1);
  }
}
```

### Card Layout

```scss
.card {
  padding: $spacing-lg;
  background: $color-light;
  border-radius: $border-radius-md;
  @include shadow-card;
}
```

### Button Group

```scss
.button-group {
  @include flex-center;
  gap: $spacing-md;
  
  button {
    @include button-base;
    background: $color-primary;
    color: white;
  }
}
```

### Navigation Header

```scss
.navbar {
  @include flex-between;
  padding: $spacing-md $spacing-lg;
  background: $bg-color-dark;
  border-bottom: $border-width solid $color-primary;
}
```

### Modal Overlay

```scss
.modal-backdrop {
  @include fixed-cover;
  background: rgba(0, 0, 0, 0.5);
  @include flex-center;
  z-index: $z-modal-backdrop;
}

.modal {
  background: $color-light;
  padding: $spacing-xl;
  border-radius: $border-radius-lg;
  z-index: $z-modal;
  @include shadow-xl;
}
```

---

## Tips & Best Practices

### ✅ DO
- Use variables for all colors, spacing, fonts
- Use mixins for common patterns
- Import variables/mixins at top of style block
- Use `@include respond-to()` for responsive design
- Keep component styles in `<style scoped>`

### ❌ DON'T
- Hardcode colors (`#646cff` instead of `$color-primary`)
- Hardcode spacing (`1rem` instead of `$spacing-md`)
- Use `!important` (use specificity instead)
- Copy/paste styles (use mixins instead)

---

## Extending the System

### Add Custom Variables

Edit `src/styles/_variables.scss`:
```scss
// Custom brand colors
$color-brand-red: #e74c3c;
$color-brand-blue: #3498db;
```

### Add Custom Mixins

Edit `src/styles/_mixins.scss`:
```scss
@mixin my-custom-style {
  // Your reusable style
}
```

### Add Component Styles

Create `src/styles/components/_button.scss`:
```scss
.btn {
  // Button styles here
}
```

Then import in `main.scss`:
```scss
@import './components/button';
```

---

## Troubleshooting

**Issue**: Variables not found
- **Solution**: Make sure to import `@import '@/styles/variables'` at top of style block

**Issue**: Mixin not working
- **Solution**: Import both `@import '@/styles/variables'` and `@import '@/styles/mixins'`

**Issue**: Styles not applying
- **Solution**: Check you're using correct variable name (e.g., `$spacing-md` not `$space-md`)

---

## Reference

- **Variables file**: `src/styles/_variables.scss`
- **Mixins file**: `src/styles/_mixins.scss`
- **Global styles**: `src/styles/main.scss`

Happy styling! 🎨

