import { ArgumentError } from '@jackwener/opencli/errors'
import { Strategy, cli } from '@jackwener/opencli/registry'

import { CATSCO_APP_URL, CATSCO_DOMAIN, CATSCO_ENDPOINTS, buildGetScript } from './src/lib/api'
import { unwrapApi } from './src/lib/normalize'

interface GroupInfoResponse {
  group?: {
    id?: number
    name?: string
    kind?: string
    member_count?: number
    agent_ids?: number[]
  }
  members?: Array<{ user_id?: number }>
}

cli({
  site: 'catsco',
  name: 'group-info',
  description: 'CatsCo inspect exact group kind and membership before Loop use',
  access: 'read',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  defaultFormat: 'json',
  args: [{ name: 'group', positional: true, required: true, help: 'Group id' }],
  columns: ['groupId', 'topic', 'name', 'kind', 'memberCount', 'agentIds', 'memberIds'],
  func: async (page: any, kwargs: any) => {
    const rawGroup = String(kwargs.group ?? '').trim()
    if (!/^[1-9]\d*$/.test(rawGroup)) throw new ArgumentError('group id must be a positive integer')
    const envelope = await page.evaluate(buildGetScript(
      `${CATSCO_ENDPOINTS.groupInfo}?id=${encodeURIComponent(rawGroup)}`
    ))
    const response = unwrapApi<GroupInfoResponse>(envelope)
    const group = response.group ?? {}
    const groupId = String(group.id ?? rawGroup)
    return {
      groupId,
      topic: `grp_${groupId}`,
      name: String(group.name ?? ''),
      kind: String(group.kind ?? ''),
      memberCount: Number(group.member_count ?? 0),
      agentIds: (group.agent_ids ?? []).map(String).join(','),
      memberIds: (response.members ?? []).map((member) => String(member.user_id ?? '')).filter(Boolean).join(',')
    }
  }
})
