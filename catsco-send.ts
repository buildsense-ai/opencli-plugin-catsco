import { readFileSync } from 'node:fs'
import { ArgumentError } from '@jackwener/opencli/errors'
import { Strategy, cli } from '@jackwener/opencli/registry'

import { CATSCO_APP_URL, CATSCO_DOMAIN, CATSCO_ENDPOINTS, buildPostScript } from './src/lib/api'
import { unwrapApi } from './src/lib/normalize'
import { recordReceipt, sha256Hex } from './src/lib/receipt'

interface SendResponseBody {
  id?: number
  seq_id?: number
  topic_id?: string
  client_msg_id?: string
  duplicate?: boolean
  content?: unknown
}

cli({
  site: 'catsco',
  name: 'send',
  description:
    'CatsCo send a message to a topic — idempotent when --client-message-id is given',
  access: 'write',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  defaultFormat: 'json',
  args: [
    { name: 'topic', positional: true, required: true, help: 'Conversation topic id, e.g. p2p_275_574 or grp_1258' },
    { name: 'content', positional: true, help: 'Message content (omit when using --content-file)' },
    { name: 'client-message-id', help: 'Idempotency key — server dedupes on (topic, sender, client_msg_id)' },
    { name: 'content-file', help: 'Read message content from this file instead of the content argument' }
  ],
  columns: ['messageId', 'topicId', 'clientMsgId', 'seqId', 'duplicate', 'contentDigest'],
  func: async (page: any, kwargs: any) => {
    const topic = String(kwargs.topic)
    const clientMsgId = kwargs['client-message-id'] ? String(kwargs['client-message-id']) : ''
    const contentFile = kwargs['content-file'] ? String(kwargs['content-file']) : ''

    let content = String(kwargs.content ?? '').trim()
    if (contentFile) {
      try {
        content = readFileSync(contentFile, 'utf8').trim()
      } catch (error) {
        throw new ArgumentError(`could not read --content-file ${contentFile}: ${(error as Error).message}`)
      }
    }
    if (!content) {
      throw new ArgumentError('message content cannot be empty — pass content or --content-file')
    }

    const body: Record<string, unknown> = { topic_id: topic, type: 'text', content }
    if (clientMsgId) body.client_msg_id = clientMsgId

    const script = buildPostScript(CATSCO_ENDPOINTS.sendMessage, body)
    const envelope = await page.evaluate(script)
    const response = unwrapApi<SendResponseBody>(envelope)

    const messageId = String(response.seq_id ?? response.id ?? '')
    const seqId = String(response.seq_id ?? response.id ?? '')
    const duplicate = response.duplicate === true

    const receipt = {
      messageId,
      topicId: String(response.topic_id ?? topic),
      clientMsgId: String(response.client_msg_id ?? clientMsgId),
      seqId,
      duplicate,
      contentDigest: sha256Hex(content),
      recordedAt: new Date().toISOString()
    }

    // Record the receipt so `message-receipt` can reconcile after a timeout.
    if (clientMsgId) recordReceipt(receipt)

    return receipt
  }
})
