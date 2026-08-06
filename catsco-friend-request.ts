import { Strategy, cli } from '@jackwener/opencli/registry'

import { CATSCO_APP_URL, CATSCO_DOMAIN, CATSCO_ENDPOINTS, buildPostScript } from './src/lib/api'
import { normalizeFriendAction, unwrapApi } from './src/lib/normalize'

cli({
  site: 'catsco',
  name: 'friend-request',
  description: 'CatsCo send a friend request to a user',
  access: 'write',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  defaultFormat: 'json',
  args: [
    { name: 'user', positional: true, required: true, help: 'Target user id' },
    { name: 'message', help: 'Optional request message' }
  ],
  columns: ['id', 'status'],
  func: async (page: any, kwargs: any) => {
    const body: Record<string, unknown> = { user_id: Number(kwargs.user) }
    if (kwargs.message) body.message = String(kwargs.message)
    const script = buildPostScript(CATSCO_ENDPOINTS.friendRequest, body)
    const envelope = await page.evaluate(script)
    const response = unwrapApi<unknown>(envelope)
    return normalizeFriendAction(response)
  }
})
