import { Strategy, cli } from '@jackwener/opencli/registry'

import { CATSCO_APP_URL, CATSCO_DOMAIN, CATSCO_ENDPOINTS, buildGetScript } from './src/lib/api'
import { contentString, extractList, normalizeMessage, unwrapApi, type RawMessage } from './src/lib/normalize'
import { sha256Hex } from './src/lib/receipt'

cli({
  site: 'catsco',
  name: 'messages',
  description:
    'CatsCo read messages in a topic — or pull after a stable seq cursor with --after-seq',
  access: 'read',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  defaultFormat: 'json',
  args: [
    { name: 'topic', positional: true, required: true, help: 'Conversation topic id, e.g. p2p_275_574 or grp_1258' },
    { name: 'limit', type: 'number', help: 'Number of messages to fetch (default 50; up to 200)' },
    { name: 'offset', type: 'number', help: 'Offset for pagination (default 0)' },
    { name: 'after-seq', type: 'number', help: 'Cursor mode: return messages with seq > this, ascending, as an envelope' }
  ],
  columns: ['seqId', 'type', 'from', 'content', 'createdAt'],
  func: async (page: any, kwargs: any) => {
    const topic = String(kwargs.topic)
    const limit = Math.min(200, Math.max(1, Number(kwargs.limit ?? 50)))
    const offset = Math.max(0, Number(kwargs.offset ?? 0))
    const afterSeq = kwargs['after-seq'] != null ? Number(kwargs['after-seq']) : null

    // Cursor mode: pull the newest batch, keep only seq > afterSeq, return an
    // envelope. The backend has no after_seq param, so this fetches latest=N
    // (ascending) and filters client-side — correct for bounded topics.
    if (afterSeq != null) {
      const url = `${CATSCO_ENDPOINTS.messages}?topic_id=${encodeURIComponent(topic)}&limit=${limit}&offset=0&latest=1`
      const script = buildGetScript(url)
      const envelope = await page.evaluate(script)
      const body = unwrapApi<{ messages?: RawMessage[] }>(envelope)
      const ascending = (body?.messages ?? [])
        .slice()
        .sort((a, b) => Number(a.seq_id ?? a.id ?? 0) - Number(b.seq_id ?? b.id ?? 0))
      const fresh = ascending.filter((message) => Number(message.seq_id ?? message.id ?? 0) > afterSeq)

      const items = fresh.map((message) => {
        const seq = Number(message.seq_id ?? message.id ?? 0)
        const content = contentString(message.content)
        return {
          messageId: String(message.id ?? message.seq_id ?? ''),
          seqId: String(seq),
          topicId: String(message.topic_id ?? topic),
          senderUid: String(message.from_uid ?? message.from ?? ''),
          kind: String(message.type ?? message.msg_type ?? ''),
          content,
          mentions: Array.isArray(message.mentions) ? message.mentions.map(String) : [],
          contentDigest: sha256Hex(content),
          serverReceivedAt: String(message.created_at ?? '')
        }
      })

      const nextSeq = items.length ? Number(items[items.length - 1].seqId) : afterSeq
      return {
        items,
        nextCursor: String(nextSeq),
        hasMore: fresh.length >= limit
      }
    }

    // Default mode: return the requested window as rows.
    const url = `${CATSCO_ENDPOINTS.messages}?topic_id=${encodeURIComponent(topic)}&limit=${limit}&offset=${offset}`
    const script = buildGetScript(url)
    const envelope = await page.evaluate(script)
    const body = unwrapApi<unknown>(envelope)
    return extractList<RawMessage>(body, 'messages').map(normalizeMessage)
  }
})
