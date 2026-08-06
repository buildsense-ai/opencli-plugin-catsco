import { Strategy, cli } from '@jackwener/opencli/registry'

import { CATSCO_APP_URL, CATSCO_DOMAIN, CATSCO_ENDPOINTS, buildGetScript } from './src/lib/api'
import { extractList, normalizeGroup, unwrapApi, type RawGroup } from './src/lib/normalize'

cli({
  site: 'catsco',
  name: 'groups',
  description: 'CatsCo list my groups',
  access: 'read',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['id', 'name', 'kind', 'memberCount', 'hasBot', 'ownerId', 'agentIds'],
  func: async (page: any) => {
    const script = buildGetScript(CATSCO_ENDPOINTS.groups)
    const envelope = await page.evaluate(script)
    const body = unwrapApi<unknown>(envelope)
    return extractList<RawGroup>(body, 'groups').map(normalizeGroup)
  }
})
