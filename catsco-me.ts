import { Strategy, cli } from '@jackwener/opencli/registry'

import { CATSCO_APP_URL, CATSCO_DOMAIN, CATSCO_ENDPOINTS, buildGetScript } from './src/lib/api'
import {
  extractList,
  normalizeUser,
  unwrapApi,
  type RawUser,
  type UserRow
} from './src/lib/normalize'

cli({
  site: 'catsco',
  name: 'me',
  description: 'CatsCo current user profile',
  access: 'read',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  defaultFormat: 'table',
  args: [],
  columns: ['uid', 'username', 'email', 'displayName', 'accountType', 'createdAt'],
  func: async (page: any) => {
    const script = buildGetScript(CATSCO_ENDPOINTS.me)
    const envelope = await page.evaluate(script)
    const body = unwrapApi<unknown>(envelope)

    if (body && typeof body === 'object' && 'uid' in (body as object)) {
      return [normalizeUser(body as RawUser)]
    }

    const rows: UserRow[] = extractList<RawUser>(body, 'me').map(normalizeUser)
    return rows
  }
})
