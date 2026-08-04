import { ArgumentError } from '@jackwener/opencli/errors'
import { Strategy, cli } from '@jackwener/opencli/registry'

import { CATSCO_APP_URL, CATSCO_DOMAIN, CATSCO_ENDPOINTS, buildPostScript } from './src/lib/api'
import { normalizeSend, unwrapApi } from './src/lib/normalize'

cli({
  site: 'catsco',
  name: 'send',
  description: 'CatsCo send a text message to a conversation topic',
  access: 'write',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  defaultFormat: 'plain',
  args: [
    { name: 'topic', positional: true, required: true, help: 'Conversation topic id, e.g. p2p_275_574 or grp_1258' },
    { name: 'content', positional: true, required: true, help: 'Message text to send' }
  ],
  columns: ['topicId', 'seqId', 'type', 'content'],
  func: async (page: any, kwargs: any) => {
    const topic = String(kwargs.topic)
    const content = String(kwargs.content ?? '').trim()

    if (!content) {
      throw new ArgumentError('message content cannot be empty')
    }

    const script = buildPostScript(CATSCO_ENDPOINTS.sendMessage, {
      topic_id: topic,
      type: 'text',
      content
    })
    const envelope = await page.evaluate(script)
    const body = unwrapApi<unknown>(envelope)
    return [normalizeSend(body)]
  }
})
