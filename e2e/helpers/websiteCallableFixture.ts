import type { Page } from '@playwright/test'
import type { WebsiteRequests } from '../../src/features/website/commandContracts.js'

type WebsiteRequest = {
  [A in keyof WebsiteRequests]: { action: A } & NonNullable<WebsiteRequests[A]>
}[keyof WebsiteRequests]
// Actions with no payload still carry their discriminant over the wire.
type EmptyRequest = { action: 'load' | 'listRevisions' }
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
class FixtureFailure {
  constructor(
    readonly httpStatus: number,
    readonly status: string,
    readonly message: string,
  ) {}
}
export const websiteFixtureFailure = (httpStatus: number, status: string, message: string) =>
  new FixtureFailure(httpStatus, status, message)

/** Shares callable transport only; each test retains its own history/conflict/publication model. */
export async function routeWebsiteBuilderFixture(
  page: Page,
  respond: (request: WebsiteRequest | EmptyRequest) => unknown | Promise<unknown>,
) {
  await page.route('**/websiteBuilder', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    const result = await respond(route.request().postDataJSON().data)
    if (result instanceof FixtureFailure) {
      await route.fulfill({
        status: result.httpStatus,
        headers,
        json: { error: { status: result.status, message: result.message } },
      })
    } else await route.fulfill({ headers, json: { result } })
  })
}
