import { ArgumentError } from '@jackwener/opencli/errors'
import { Strategy, cli } from '@jackwener/opencli/registry'

import { CATSCO_APP_URL, CATSCO_DOMAIN, CATSCO_ENDPOINTS, buildPostScript } from './src/lib/api'
import { normalizeProject, unwrapApi, type RawProject } from './src/lib/normalize'

cli({
  site: 'catsco',
  name: 'project-create',
  description: 'CatsCo create an owner-scoped Project for conversations and Agent Tasks',
  access: 'write',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  defaultFormat: 'json',
  args: [{ name: 'name', positional: true, required: true, help: 'Project name, 1-128 characters' }],
  columns: ['id', 'name', 'ownerUid', 'createdAt'],
  func: async (page: any, kwargs: any) => {
    const name = String(kwargs.name ?? '').trim()
    if (!name || name.length > 128) throw new ArgumentError('project name must be 1-128 characters')
    const body = unwrapApi<unknown>(await page.evaluate(buildPostScript(CATSCO_ENDPOINTS.projects, { name })))
    const project = body && typeof body === 'object' && 'project' in body
      ? (body as { project: RawProject }).project
      : body as RawProject
    const normalized = normalizeProject(project)
    if (!/^[1-9]\d*$/.test(normalized.id) || normalized.name !== name) {
      throw new ArgumentError('CatsCo project creation returned an invalid Project')
    }
    return normalized
  },
})
