import { ArgumentError } from '@jackwener/opencli/errors'
import { Strategy, cli } from '@jackwener/opencli/registry'

import { CATSCO_APP_URL, CATSCO_DOMAIN, CATSCO_ENDPOINTS, buildGetScript } from './src/lib/api'
import { unwrapApi, type RawMessage } from './src/lib/normalize'
import { getReceipt } from './src/lib/receipt'

cli({
  site: 'catsco',
  name: 'message-receipt',
  description:
    'CatsCo look up the receipt for an idempotent send by client message id (reconcile after timeout)',
  access: 'read',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  defaultFormat: 'json',
  args: [
    { name: 'topic', positional: true, required: true, help: 'Conversation topic id, e.g. p2p_275_574' },
    { name: 'client-message-id', required: true, help: 'The idempotency key used when sending' }
  ],
  columns: ['found', 'messageId', 'topicId', 'clientMsgId', 'seqId', 'serverConfirmed', 'contentDigest'],
  func: async (page: any, kwargs: any) => {
    const topic = String(kwargs.topic)
    const clientMsgId = String(kwargs['client-message-id'] ?? '').trim()

    if (!clientMsgId) {
      throw new ArgumentError('--client-message-id is required')
    }

    const receipt = getReceipt(topic, clientMsgId)
    if (!receipt) {
      return { found: false }
    }

    // Confirm the message still exists on the server by locating its seq in history.
    const url = `${CATSCO_ENDPOINTS.messages}?topic_id=${encodeURIComponent(topic)}&limit=100&offset=0&latest=1`
    const script = buildGetScript(url)
    const envelope = await page.evaluate(script)
    const body = unwrapApi<{ messages?: RawMessage[] }>(envelope)
    const onServer = (body?.messages ?? []).find(
      (message) => String(message.seq_id ?? message.id ?? '') === receipt.seqId
    )

    return {
      found: true,
      messageId: receipt.messageId,
      topicId: receipt.topicId,
      clientMsgId: receipt.clientMsgId,
      seqId: receipt.seqId,
      contentDigest: receipt.contentDigest,
      serverConfirmed: Boolean(onServer),
      serverReceivedAt: onServer?.created_at ?? null
    }
  }
})
