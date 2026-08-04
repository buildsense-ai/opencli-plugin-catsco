import { Strategy, cli } from '@jackwener/opencli/registry'

import { CATSCO_APP_URL, CATSCO_DOMAIN, CATSCO_ENDPOINTS, buildGetScript } from './src/lib/api'
import {
  extractList,
  normalizeMessage,
  unwrapApi,
  type RawMessage
} from './src/lib/normalize'

cli({
  site: 'catsco',
  name: 'messages',
  description: 'CatsCo read messages in a conversation topic',
  access: 'read',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'topic', positional: true, required: true, help: 'Conversation topic id, e.g. p2p_275_574 or grp_1258' },
    { name: 'limit', type: 'number', help: 'Number of messages to fetch (default 50)' },
    { name: 'offset', type: 'number', help: 'Offset for pagination (default 0)' }
  ],
  columns: ['seqId', 'type', 'from', 'content', 'createdAt'],
  func: async (page: any, kwargs: any) => {
    const topic = String(kwargs.topic)
    const limit = Number(kwargs.limit ?? 50)
    const offset = Number(kwargs.offset ?? 0)
    const url = `${CATSCO_ENDPOINTS.messages}?topic_id=${encodeURIComponent(topic)}&limit=${limit}&offset=${offset}`
    const script = buildGetScript(url)
    const envelope = await page.evaluate(script)
    const body = unwrapApi<unknown>(envelope)
    return extractList<RawMessage>(body, 'messages').map(normalizeMessage)
  }
})
