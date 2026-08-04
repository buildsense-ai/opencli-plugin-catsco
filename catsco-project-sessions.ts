import { Strategy, cli } from '@jackwener/opencli/registry'

import {
  CATSCO_APP_URL,
  CATSCO_DOMAIN,
  CATSCO_ENDPOINTS,
  buildGetScript
} from './src/lib/api'
import {
  extractList,
  normalizeConversation,
  unwrapApi,
  type RawConversation
} from './src/lib/normalize'

cli({
  site: 'catsco',
  name: 'project-sessions',
  description: 'CatsCo list sessions (conversations) inside a project',
  access: 'read',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'project', positional: true, required: true, help: 'Project id or name, e.g. 24 or 开发' }
  ],
  columns: ['topicId', 'name', 'preview', 'lastTime', 'taskState'],
  func: async (page: any, kwargs: any) => {
    const project = String(kwargs.project).trim()
    const isNumeric = /^\d+$/.test(project)

    const script = buildGetScript(CATSCO_ENDPOINTS.conversations)
    const envelope = await page.evaluate(script)
    const body = unwrapApi<unknown>(envelope)
    const conversations = extractList<RawConversation>(body, 'conversations')

    const filtered = conversations.filter((conversation) =>
      isNumeric
        ? String(conversation.project_id) === project
        : String(conversation.project_name) === project
    )

    return filtered.map(normalizeConversation)
  }
})
