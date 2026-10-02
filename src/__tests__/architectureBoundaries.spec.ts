import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = join(process.cwd(), 'src')
const guardedDirectories = [
  'views',
  'components',
  'layouts',
  'router',
  'features',
  'composables',
  'stores',
]
const directFirebaseImportPattern = /from\s+['"](?:@\/firebase|firebase\/[^'"]*)['"]/
const componentIntegrationImportPattern = /from\s+['"](@\/(?:services|stores)\/[^'"]*)['"]/g
// Feature containers coordinate existing service boundaries. Shared presentation
// components remain disconnected; adding a dependency requires explicit review.
const connectedContainers: Record<string, string[]> = {
  'auth/LocalFormsSignIn.vue': ['@/stores/auth'],
  'dashboard/FormDashboardWidget.vue': ['@/services/forms', '@/stores/auth'],
  'dashboard/RoleResourcesModule.vue': ['@/stores/auth', '@/services/sds'],
  'dashboard/SdsExplorerModule.vue': ['@/stores/auth', '@/services/sds'],
  'dashboard/SdsFileViewer.vue': ['@/services/sds'],
  'dashboard/WidgetDashboard.vue': ['@/stores/auth', '@/services/dashboard', '@/services/forms'],
  'forms/FormOutputSettings.vue': ['@/services/forms'],
  'forms/FormResponseWorkspace.vue': ['@/stores/auth', '@/services/forms'],
  'website/WebsiteFormSubmissions.vue': ['@/services/website'],
  'website/WebsiteImage.vue': ['@/services/website'],
  'website/WebsiteImagePicker.vue': ['@/services/website'],
  'website/WebsitePublicForm.vue': ['@/services/website'],
  'website/WebsitePublishComparison.vue': ['@/services/website'],
  'website/WebsiteRevisionHistory.vue': ['@/services/website'],
  'website/WebsiteScriptFrame.vue': ['@/services/website'],
}

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
          .flatMap((line, index) =>
            directFirebaseImportPattern.test(line)
              ? [`${relative(sourceRoot, filePath)}:${index + 1}: ${line.trim()}`]
              : [],
          )
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

  it('limits service and store dependencies to reviewed feature containers', () => {
    const componentDirectory = join(sourceRoot, 'components')
    const violations = collectSourceFiles(componentDirectory).flatMap((filePath) => {
      const contents = readFileSync(filePath, 'utf8')
      const allowed =
        connectedContainers[relative(componentDirectory, filePath).replace(/\\/g, '/')] ?? []

      return contents
        .split(/\r?\n/)
        .flatMap((line, index) =>
          [...line.matchAll(componentIntegrationImportPattern)]
            .filter((match) => !allowed.includes(match[1]!))
            .map(() => `${relative(sourceRoot, filePath)}:${index + 1}: ${line.trim()}`),
        )
    })

    expect(violations).toEqual([])
  })
})
