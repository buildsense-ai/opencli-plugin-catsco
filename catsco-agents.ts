import { Strategy, cli } from '@jackwener/opencli/registry'

import { CATSCO_APP_URL, CATSCO_DOMAIN, CATSCO_ENDPOINTS, buildGetScript } from './src/lib/api'
import {
  extractList,
  normalizeAgent,
  unwrapApi,
  type RawAgent
} from './src/lib/normalize'

cli({
  site: 'catsco',
  name: 'agents',
  description: 'CatsCo list my agents (bots) with online status',
  access: 'read',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['uid', 'displayName', 'username', 'relation', 'online', 'topicId', 'visibility'],
  func: async (page: any) => {
    const script = buildGetScript(CATSCO_ENDPOINTS.agents)
    const envelope = await page.evaluate(script)
    const body = unwrapApi<unknown>(envelope)
    return extractList<RawAgent>(body, 'agents').map(normalizeAgent)
  }
})
