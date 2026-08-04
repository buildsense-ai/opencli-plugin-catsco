import { ArgumentError, AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors'
import { Strategy, cli } from '@jackwener/opencli/registry'

import {
  CATSCO_APP_URL,
  CATSCO_DOMAIN,
  CATSCO_ENDPOINTS,
  buildGetScript,
  buildLoginScript
} from './src/lib/api'
import { normalizeUser, unwrapApi, type RawUser } from './src/lib/normalize'

cli({
  site: 'catsco',
  name: 'login',
  description: 'CatsCo log in and persist the session to the browser',
  access: 'write',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  defaultFormat: 'table',
  args: [
    { name: 'account', positional: true, required: true, help: 'Email or username' },
    { name: 'password', help: 'Password (falls back to the CATSCO_PASSWORD env var)' }
  ],
  columns: ['uid', 'username', 'email', 'displayName', 'accountType'],
  func: async (page: any, kwargs: any) => {
    const account = String(kwargs.account)
    const password = String(kwargs.password ?? process.env.CATSCO_PASSWORD ?? '')

    if (!password) {
      throw new ArgumentError(
        'password required — pass --password or set the CATSCO_PASSWORD environment variable'
      )
    }

    const loginScript = buildLoginScript(account, password)
    const envelope = await page.evaluate(loginScript)

    // A 401/403 here means wrong credentials, not "auth required".
    if (envelope.status === 401 || envelope.status === 403) {
      const detail =
        envelope.body && typeof envelope.body === 'object' && 'error' in envelope.body
          ? String((envelope.body as { error: unknown }).error)
          : 'wrong account or password'
      throw new AuthRequiredError(CATSCO_DOMAIN, `Login failed — ${detail}`)
    }
    if (envelope.status >= 400) {
      const detail =
        envelope.body && typeof envelope.body === 'object' && 'error' in envelope.body
          ? String((envelope.body as { error: unknown }).error)
          : `HTTP ${envelope.status}`
      throw new CommandExecutionError(`CatsCo login failed — ${detail}`)
    }

    if (!envelope.body || typeof envelope.body !== 'object' || !('token' in (envelope.body as object))) {
      throw new CommandExecutionError('CatsCo login succeeded but no token was returned')
    }

    // Reload the app so it boots with the freshly stored session.
    await page.goto(CATSCO_APP_URL, { waitUntil: 'load' })

    // Verify the persisted session and return the current profile.
    const me = await page.evaluate(buildGetScript(CATSCO_ENDPOINTS.me))
    const meBody = unwrapApi<unknown>(me)
    return [normalizeUser(meBody as RawUser)]
  }
})
