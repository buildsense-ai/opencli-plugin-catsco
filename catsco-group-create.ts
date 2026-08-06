import { ArgumentError } from '@jackwener/opencli/errors'
import { Strategy, cli } from '@jackwener/opencli/registry'

import { CATSCO_APP_URL, CATSCO_DOMAIN, CATSCO_ENDPOINTS, buildPostScript } from './src/lib/api'
import { unwrapApi } from './src/lib/normalize'

interface GroupCreateResponse {
  group_id?: number
  topic?: string
  name?: string
  kind?: string
  member_count?: number
  agent_ids?: number[]
}

cli({
  site: 'catsco',
  name: 'group-create',
  description: 'CatsCo create a standard collaboration group with existing users and Agents',
  access: 'write',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  defaultFormat: 'json',
  args: [
    { name: 'name', positional: true, required: true, help: 'Group name' },
    { name: 'members', positional: true, required: true, help: 'Comma-separated user or Agent UIDs, e.g. 574,559' }
  ],
  columns: ['groupId', 'topic', 'name', 'kind', 'memberCount', 'agentIds'],
  func: async (page: any, kwargs: any) => {
    const name = String(kwargs.name ?? '').trim()
    if (!name) throw new ArgumentError('group name cannot be empty')

    const memberParts = String(kwargs.members ?? '').split(',').map((part) => part.trim())
    if (memberParts.length === 0 || memberParts.some((part) => !/^[1-9]\d*$/.test(part))) {
      throw new ArgumentError('every member id must be a positive integer (comma-separated)')
    }
    const memberIds = memberParts.map(Number)

    const envelope = await page.evaluate(buildPostScript(CATSCO_ENDPOINTS.groupCreate, {
      name,
      member_ids: [...new Set(memberIds)],
      kind: 'standard'
    }))
    const response = unwrapApi<GroupCreateResponse>(envelope)
    return {
      groupId: String(response.group_id ?? ''),
      topic: String(response.topic ?? ''),
      name: String(response.name ?? name),
      kind: String(response.kind ?? 'standard'),
      memberCount: Number(response.member_count ?? 0),
      agentIds: (response.agent_ids ?? []).map(String).join(',')
    }
  }
})
