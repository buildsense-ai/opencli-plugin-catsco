import { ArgumentError } from '@jackwener/opencli/errors'
import { Strategy, cli } from '@jackwener/opencli/registry'

import { CATSCO_APP_URL, CATSCO_DOMAIN, CATSCO_ENDPOINTS, buildPostScript } from './src/lib/api'
import { unwrapApi } from './src/lib/normalize'

cli({
  site: 'catsco',
  name: 'project-assign-topic',
  description: 'CatsCo attach an existing conversation topic to an owned Project',
  access: 'write',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  defaultFormat: 'json',
  args: [
    { name: 'project', positional: true, required: true, help: 'Numeric CatsCo Project id' },
    { name: 'topic', positional: true, required: true, help: 'Existing CatsCo topic id, e.g. grp_1400' },
  ],
  columns: ['projectId', 'topicId', 'assigned'],
  func: async (page: any, kwargs: any) => {
    const projectId = String(kwargs.project).trim()
    const topicId = String(kwargs.topic).trim()
    if (!/^[1-9]\d*$/.test(projectId)) throw new ArgumentError('project must be a positive numeric CatsCo Project id')
    if (!/^(?:grp|p2p)_[A-Za-z0-9_]+$/.test(topicId)) throw new ArgumentError('topic must be a CatsCo grp_* or p2p_* topic id')
    unwrapApi(await page.evaluate(buildPostScript(CATSCO_ENDPOINTS.projectTopic, {
      project_id: Number(projectId), topic_id: topicId,
    })))
    return { projectId, topicId, assigned: true }
  },
})
