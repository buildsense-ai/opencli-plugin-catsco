import { Strategy, cli } from '@jackwener/opencli/registry'

import { CATSCO_APP_URL, CATSCO_DOMAIN, CATSCO_ENDPOINTS, buildGetScript } from './src/lib/api'
import { extractList, normalizeUserRow, unwrapApi, type RawUser } from './src/lib/normalize'

cli({
  site: 'catsco',
  name: 'friends',
  description: 'CatsCo list my friends',
  access: 'read',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['uid', 'username', 'displayName'],
  func: async (page: any) => {
    const script = buildGetScript(CATSCO_ENDPOINTS.friends)
    const envelope = await page.evaluate(script)
    const body = unwrapApi<unknown>(envelope)
    return extractList<RawUser>(body, 'friends').map(normalizeUserRow)
  }
})
