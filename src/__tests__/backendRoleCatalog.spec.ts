import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { CURRENT_STORED_ROLE_KEYS } from '@/auth/roles'

function readFunctionValidRoles(): string[] {
  const constantsPath = join(process.cwd(), 'functions', 'src', 'constants.ts')
  const contents = readFileSync(constantsPath, 'utf8')
  const match = contents.match(/VALID_ROLES\s*=\s*\[([\s\S]*?)\]\s*as const/)

  if (!match) {
    throw new Error('Could not find VALID_ROLES in functions/src/constants.ts')
  }

  const rolesSource = match[1] ?? ''

  return [...rolesSource.matchAll(/'([^']+)'/g)].flatMap((roleMatch) => (
    roleMatch[1] ? [roleMatch[1]] : []
  ))
}

describe('backend role catalog alignment', () => {
  it('keeps Cloud Functions stored-role validation aligned with the frontend stored role catalog', () => {
    expect(readFunctionValidRoles()).toEqual([...CURRENT_STORED_ROLE_KEYS])
  })
})
