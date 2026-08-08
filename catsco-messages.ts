import { Strategy, cli } from '@jackwener/opencli/registry'
import { ArgumentError } from '@jackwener/opencli/errors'

import { CATSCO_APP_URL, CATSCO_DOMAIN, CATSCO_ENDPOINTS, buildGetScript } from './src/lib/api'
import { contentString, extractList, messageMentions, normalizeMessage, unwrapApi, type RawMessage } from './src/lib/normalize'
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

    // Cursor mode is server-authoritative: the API returns the first bounded,
    // ascending page after after_seq. Never synthesize a cursor from a latest-N
    // window, because that can permanently skip a backlog larger than the window.
    if (afterSeq != null) {
      if (!Number.isSafeInteger(afterSeq) || afterSeq < 0) {
        throw new ArgumentError('after-seq must be a non-negative safe integer')
      }
      const url = `${CATSCO_ENDPOINTS.messages}?topic_id=${encodeURIComponent(topic)}&limit=${limit}&after_seq=${afterSeq}`
      const script = buildGetScript(url)
      const envelope = await page.evaluate(script)
      const body = unwrapApi<{ messages?: RawMessage[]; next_cursor?: number | string; has_more?: boolean; cursor_version?: string }>(envelope)
      if (body?.cursor_version !== 'after_seq_v1') throw new ArgumentError('CatsCo after-seq response did not provide the continuous cursor contract')
      if (!Array.isArray(body?.messages)) throw new ArgumentError('CatsCo after-seq response did not include messages')
      const items = body.messages.map((message) => {
        const seq = Number(message.seq_id ?? message.id ?? 0)
        if (!Number.isSafeInteger(seq) || seq <= afterSeq) throw new ArgumentError('CatsCo after-seq response returned an invalid sequence')
        const content = contentString(message.content)
        return {
          messageId: String(message.id ?? message.seq_id ?? ''),
          seqId: String(seq),
          topicId: String(message.topic_id ?? topic),
          senderUid: String(message.from_uid ?? message.from ?? ''),
          kind: String(message.type ?? message.msg_type ?? ''),
          content,
          mentions: messageMentions(message),
          contentDigest: sha256Hex(content),
          serverReceivedAt: String(message.created_at ?? '')
        }
      })
      for (let index = 1; index < items.length; index++) {
        if (Number(items[index].seqId) <= Number(items[index - 1].seqId)) {
          throw new ArgumentError('CatsCo after-seq response was not strictly ascending')
        }
      }
      const expectedCursor = items.length ? Number(items[items.length - 1].seqId) : afterSeq
      const nextCursor = Number(body.next_cursor)
      if (!Number.isSafeInteger(nextCursor) || nextCursor !== expectedCursor) {
        throw new ArgumentError('CatsCo after-seq response had an invalid next_cursor')
      }
      if (typeof body.has_more !== 'boolean') throw new ArgumentError('CatsCo after-seq response had an invalid has_more')
      return { cursorVersion: 'after-seq-v1', items, nextCursor: String(nextCursor), hasMore: body.has_more }
    }

    // Default mode: return the requested window as rows.
    const url = `${CATSCO_ENDPOINTS.messages}?topic_id=${encodeURIComponent(topic)}&limit=${limit}&offset=${offset}`
    const script = buildGetScript(url)
    const envelope = await page.evaluate(script)
    const body = unwrapApi<unknown>(envelope)
    return extractList<RawMessage>(body, 'messages').map(normalizeMessage)
  }
})
