import { Strategy, cli } from '@jackwener/opencli/registry'

import { CATSCO_APP_URL, CATSCO_DOMAIN, CATSCO_ENDPOINTS, buildGetScript } from './src/lib/api'
import {
  extractList,
  normalizeAgentEntry,
  unwrapApi,
  type RawAgentEntry
} from './src/lib/normalize'

cli({
  site: 'catsco',
  name: 'entries',
  description: 'CatsCo task entries for a given agent',
  access: 'read',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'agent', positional: true, required: true, help: 'Agent uid, e.g. 574' }
  ],
  columns: ['id', 'channel', 'sceneKey', 'accessMode', 'status'],
  func: async (page: any, kwargs: any) => {
    const agent = String(kwargs.agent)
    const url = `${CATSCO_ENDPOINTS.agentEntries}?agent_uid=${encodeURIComponent(agent)}`
    const script = buildGetScript(url)
    const envelope = await page.evaluate(script)
    const body = unwrapApi<unknown>(envelope)
    return extractList<RawAgentEntry>(body, 'entries').map(normalizeAgentEntry)
  }
})
