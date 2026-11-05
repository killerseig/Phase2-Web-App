/** Mirrors the existing employee-form listing boundary; visibility never grants access. */
export function canListCompanyForms(role: string): boolean {
  return ['admin', 'project-manager', 'foreman', 'shop-foreman'].includes(role)
}
