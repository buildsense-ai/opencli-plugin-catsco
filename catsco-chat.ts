import { ArgumentError, CommandExecutionError } from '@jackwener/opencli/errors'
import { Strategy, cli } from '@jackwener/opencli/registry'

import {
  CATSCO_APP_URL,
  CATSCO_DOMAIN,
  CATSCO_ENDPOINTS,
  buildPostScript
} from './src/lib/api'
import { normalizeOpen, normalizeSend, unwrapApi } from './src/lib/normalize'

cli({
  site: 'catsco',
  name: 'chat',
  description: 'CatsCo private-chat an agent — opens the agent and sends a message',
  access: 'write',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  defaultFormat: 'plain',
  args: [
    { name: 'agent', positional: true, required: true, help: 'Agent uid, e.g. 574' },
    { name: 'message', positional: true, required: true, help: 'Message text to send' }
  ],
  columns: ['topicId', 'seqId', 'type', 'content'],
  func: async (page: any, kwargs: any) => {
    const agentUid = Number(kwargs.agent)
    const message = String(kwargs.message ?? '').trim()

    if (!message) {
      throw new ArgumentError('message content cannot be empty')
    }

    // 1. Open the agent to resolve its private (p2p) conversation topic.
    const openScript = buildPostScript(CATSCO_ENDPOINTS.openAgent, { agent_uid: agentUid })
    const openEnvelope = await page.evaluate(openScript)
    const openBody = unwrapApi<unknown>(openEnvelope)
    const topic = normalizeOpen(openBody).topic

    if (!topic) {
      throw new CommandExecutionError(`CatsCo could not resolve a topic for agent ${agentUid}`)
    }

    // 2. Send the message to that topic.
    const sendScript = buildPostScript(CATSCO_ENDPOINTS.sendMessage, {
      topic_id: topic,
      type: 'text',
      content: message
    })
    const sendEnvelope = await page.evaluate(sendScript)
    const sendBody = unwrapApi<unknown>(sendEnvelope)

    return [normalizeSend(sendBody)]
  }
})
