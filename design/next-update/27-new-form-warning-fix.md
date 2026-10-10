# New-form discard warning: verified fix

Untouched blank and source starter forms now establish their initial definition as the authoring baseline. Previously prefilled starters called reset(true), so Committee -> New displayed the exact discard-edits modal before any edit. A failing component regression reproduced this path before correction. Actual edits still prompt; Cancel preserves their content. Duplicated/imported meaningful unsaved content remains protected.

All four local starter buttons are covered by the component regression, alongside persisted authentic Committee/BBS fixtures, deferred loading and actual PrimeVue controls. Owner confirmed the preview fix. The isolated baseline hotfix was separately deployed to Hosting at source commit 7712266; its HTML and Form Builder bundle hashes matched live bytes.

This broader source release preserves that fix. Exact release checks and pending deployment boundaries are recorded in SOURCE-RELEASE.md. No form template was issued as part of testing.
