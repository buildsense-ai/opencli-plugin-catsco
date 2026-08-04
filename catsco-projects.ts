import { Strategy, cli } from '@jackwener/opencli/registry'

import {
  CATSCO_APP_URL,
  CATSCO_DOMAIN,
  CATSCO_ENDPOINTS,
  buildGetScript
} from './src/lib/api'
import { extractList, normalizeProject, unwrapApi, type RawProject } from './src/lib/normalize'

cli({
  site: 'catsco',
  name: 'projects',
  description: 'CatsCo list projects (task groups) with task counts',
  access: 'read',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['id', 'name', 'taskCount', 'ownerUid', 'createdAt', 'updatedAt'],
  func: async (page: any) => {
    const script = buildGetScript(CATSCO_ENDPOINTS.projects)
    const envelope = await page.evaluate(script)
    const body = unwrapApi<unknown>(envelope)
    return extractList<RawProject>(body, 'projects').map(normalizeProject)
  }
})
