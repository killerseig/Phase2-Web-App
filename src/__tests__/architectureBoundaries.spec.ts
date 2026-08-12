import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = join(process.cwd(), 'src')
const guardedDirectories = ['views', 'components', 'layouts', 'router', 'features', 'composables', 'stores']
const directFirebaseImportPattern = /from\s+['"](?:@\/firebase|firebase\/[^'"]*)['"]/
const componentIntegrationImportPattern = /from\s+['"](?:@\/services\/[^'"]*|@\/stores\/[^'"]*)['"]/

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    const stats = statSync(path)

    if (stats.isDirectory()) {
      return collectSourceFiles(path)
    }

    return /\.(ts|vue)$/.test(entry) ? [path] : []
  })
}

describe('frontend architecture boundaries', () => {
  it('keeps Firebase imports inside services', () => {
    const violations = guardedDirectories.flatMap((directoryName) => {
      const directory = join(sourceRoot, directoryName)

      return collectSourceFiles(directory).flatMap((filePath) => {
        const contents = readFileSync(filePath, 'utf8')

        return contents
          .split(/\r?\n/)
          .flatMap((line, index) => (
            directFirebaseImportPattern.test(line)
              ? [`${relative(sourceRoot, filePath)}:${index + 1}: ${line.trim()}`]
              : []
          ))
      })
    })

    expect(violations).toEqual([])
  })

  it('uses named service boundaries for Firebase auth and configuration checks', () => {
    const servicePath = join(sourceRoot, 'services', 'firebaseConfig.ts')
    const serviceContents = readFileSync(servicePath, 'utf8')
    const authServiceContents = readFileSync(join(sourceRoot, 'services', 'auth.ts'), 'utf8')

    expect(basename(servicePath)).toBe('firebaseConfig.ts')
    expect(serviceContents).toContain('hasConfiguredFirebase')
    expect(serviceContents).toContain('@/firebase')
    expect(authServiceContents).toContain('subscribeAuthSession')
    expect(authServiceContents).toContain('signInWithPassword')
    expect(authServiceContents).toContain('signOutOfAuthSession')
  })

  it('keeps components disconnected from services and stores', () => {
    const componentDirectory = join(sourceRoot, 'components')
    const violations = collectSourceFiles(componentDirectory).flatMap((filePath) => {
      const contents = readFileSync(filePath, 'utf8')

      return contents
        .split(/\r?\n/)
        .flatMap((line, index) => (
          componentIntegrationImportPattern.test(line)
            ? [`${relative(sourceRoot, filePath)}:${index + 1}: ${line.trim()}`]
            : []
        ))
    })

    expect(violations).toEqual([])
  })
})
