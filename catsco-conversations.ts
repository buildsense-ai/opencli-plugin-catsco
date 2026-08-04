import { Strategy, cli } from '@jackwener/opencli/registry'

import { CATSCO_APP_URL, CATSCO_DOMAIN, CATSCO_ENDPOINTS, buildGetScript } from './src/lib/api'
import {
  extractList,
  normalizeConversation,
  unwrapApi,
  type RawConversation
} from './src/lib/normalize'

cli({
  site: 'catsco',
  name: 'conversations',
  description: 'CatsCo recent conversations / agent tasks',
  access: 'read',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['topicId', 'name', 'preview', 'isAgentTask', 'memberCount', 'lastTime', 'taskState'],
  func: async (page: any) => {
    const script = buildGetScript(CATSCO_ENDPOINTS.conversations)
    const envelope = await page.evaluate(script)
    const body = unwrapApi<unknown>(envelope)
    return extractList<RawConversation>(body, 'conversations').map(normalizeConversation)
  }
})
