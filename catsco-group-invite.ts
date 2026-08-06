import { ArgumentError } from '@jackwener/opencli/errors'
import { Strategy, cli } from '@jackwener/opencli/registry'

import { CATSCO_APP_URL, CATSCO_DOMAIN, CATSCO_ENDPOINTS, buildPostScript } from './src/lib/api'
import { unwrapApi } from './src/lib/normalize'

interface GroupInviteResponse {
  added?: number
  requested?: number
}

cli({
  site: 'catsco',
  name: 'group-invite',
  description: 'CatsCo invite users into a group (add friends to a group)',
  access: 'write',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  defaultFormat: 'json',
  args: [
    { name: 'group', positional: true, required: true, help: 'Group id' },
    { name: 'users', positional: true, required: true, help: 'Comma-separated user ids to invite, e.g. 42,574' }
  ],
  columns: ['added', 'requested'],
  func: async (page: any, kwargs: any) => {
    const groupId = Number(kwargs.group)
    const userParts = String(kwargs.users).split(',').map((part) => part.trim())
    if (userParts.length === 0 || userParts.some((part) => !/^[1-9]\d*$/.test(part))) {
      throw new ArgumentError('every user id must be a positive integer (comma-separated)')
    }
    const userIds = userParts.map(Number)

    const script = buildPostScript(CATSCO_ENDPOINTS.groupInvite, {
      group_id: groupId,
      user_ids: userIds
    })
    const envelope = await page.evaluate(script)
    const response = unwrapApi<GroupInviteResponse>(envelope)
    return {
      added: Number(response.added ?? 0),
      requested: Number(response.requested ?? 0)
    }
  }
})
