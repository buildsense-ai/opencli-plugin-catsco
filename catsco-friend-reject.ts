import { Strategy, cli } from '@jackwener/opencli/registry'

import { CATSCO_APP_URL, CATSCO_DOMAIN, CATSCO_ENDPOINTS, buildPostScript } from './src/lib/api'
import { normalizeFriendAction, unwrapApi } from './src/lib/normalize'

cli({
  site: 'catsco',
  name: 'friend-reject',
  description: 'CatsCo reject an incoming friend request',
  access: 'write',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  defaultFormat: 'json',
  args: [
    { name: 'user', positional: true, required: true, help: 'User id who sent the request' }
  ],
  columns: ['id', 'status'],
  func: async (page: any, kwargs: any) => {
    const script = buildPostScript(CATSCO_ENDPOINTS.friendReject, { user_id: Number(kwargs.user) })
    const envelope = await page.evaluate(script)
    const response = unwrapApi<unknown>(envelope)
    return normalizeFriendAction(response)
  }
})
