import { Strategy, cli } from '@jackwener/opencli/registry'

import { CATSCO_APP_URL, CATSCO_DOMAIN, CATSCO_ENDPOINTS, buildGetScript } from './src/lib/api'
import { extractList, normalizeUserRow, unwrapApi, type RawUser } from './src/lib/normalize'

cli({
  site: 'catsco',
  name: 'user-search',
  description: 'CatsCo search users by name or uid (to find who to add as a friend)',
  access: 'read',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'query', positional: true, required: true, help: 'Search keyword (name, or uid with --mode uid)' },
    { name: 'mode', help: 'Search mode: name (default) or uid' }
  ],
  columns: ['uid', 'username', 'displayName'],
  func: async (page: any, kwargs: any) => {
    const query = String(kwargs.query)
    const mode = String(kwargs.mode ?? 'name')
    const url = `${CATSCO_ENDPOINTS.userSearch}?q=${encodeURIComponent(query)}&mode=${encodeURIComponent(mode)}`
    const script = buildGetScript(url)
    const envelope = await page.evaluate(script)
    const body = unwrapApi<unknown>(envelope)
    return extractList<RawUser>(body, 'users').map(normalizeUserRow)
  }
})
