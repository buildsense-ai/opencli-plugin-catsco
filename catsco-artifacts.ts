import { Strategy, cli } from '@jackwener/opencli/registry'

import { CATSCO_APP_URL, CATSCO_DOMAIN, buildGetScript } from './src/lib/api'
import {
  extractList,
  normalizeArtifact,
  unwrapApi,
  type RawArtifact
} from './src/lib/normalize'

cli({
  site: 'catsco',
  name: 'artifacts',
  description: 'CatsCo cloud artifacts for a given agent',
  access: 'read',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'agent', positional: true, required: true, help: 'Agent uid, e.g. 574' },
    { name: 'status', help: 'Artifact status filter, e.g. active (default active)' }
  ],
  columns: ['id', 'name', 'status', 'size'],
  func: async (page: any, kwargs: any) => {
    const agent = String(kwargs.agent)
    const status = String(kwargs.status ?? 'active')
    const url = `/api/agents/${encodeURIComponent(agent)}/artifacts?status=${encodeURIComponent(status)}`
    const script = buildGetScript(url)
    const envelope = await page.evaluate(script)
    const body = unwrapApi<unknown>(envelope)
    return extractList<RawArtifact>(body, 'artifacts').map(normalizeArtifact)
  }
})
