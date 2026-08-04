import { Strategy, cli } from '@jackwener/opencli/registry'

import { CATSCO_APP_URL, CATSCO_DOMAIN, CATSCO_ENDPOINTS, buildPostScript } from './src/lib/api'
import { normalizeOpen, unwrapApi } from './src/lib/normalize'

cli({
  site: 'catsco',
  name: 'open',
  description: 'CatsCo open / select an agent and get its conversation topic',
  access: 'write',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  defaultFormat: 'table',
  args: [
    { name: 'agent', positional: true, required: true, help: 'Agent uid, e.g. 574' }
  ],
  columns: ['agentUid', 'displayName', 'topic'],
  func: async (page: any, kwargs: any) => {
    const agentUid = Number(kwargs.agent)
    const script = buildPostScript(CATSCO_ENDPOINTS.openAgent, { agent_uid: agentUid })
    const envelope = await page.evaluate(script)
    const body = unwrapApi<unknown>(envelope)
    return [normalizeOpen(body)]
  }
})
