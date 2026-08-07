/**
 * CatsCo (app.catsco.cc) API bindings.
 *
 * CatsCo authenticates with a JSON Web Token stored in `localStorage['oc_token']`
 * (set by the web app via `le(e)` → `localStorage.setItem('oc_token', e)`). The
 * app sends it as `Authorization: Bearer <jwt>` on every request.
 *
 * Because the token lives in localStorage (not a cookie), adapters cannot rely on
 * `credentials: 'include'` alone. Every evaluate script here reads the token from
 * localStorage inside the authenticated page context and attaches it explicitly.
 * The scripts return `{ status, body }` so the adapter layer can map 401/403 to an
 * `AuthRequiredError` and surfacing a real logged-in session.
 */

export const CATSCO_DOMAIN = 'app.catsco.cc' as const
export const CATSCO_APP_URL = 'https://app.catsco.cc/' as const

export const CATSCO_ENDPOINTS = {
  me: '/api/me',
  agents: '/api/agents',
  conversations: '/api/conversations',
  messages: '/api/messages',
  agentEntries: '/api/agent-entries',
  openAgent: '/api/agents/open',
  sendMessage: '/api/messages/send',
  login: '/api/auth/login',
  projects: '/api/projects',
  projectTopic: '/api/projects/topic',
  friends: '/api/friends',
  friendRequest: '/api/friends/request',
  friendAccept: '/api/friends/accept',
  friendReject: '/api/friends/reject',
  userSearch: '/api/users/search',
  groups: '/api/groups',
  groupCreate: '/api/groups/create',
  groupInfo: '/api/groups/info',
  groupInvite: '/api/groups/invite'
} as const

/** Read the Bearer token inside the page context and build an Authorization header. */
function authHeaderScript(): string {
  return `
  const token = localStorage.getItem('oc_token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = 'Bearer ' + token
`.trim()
}

/**
 * Build an authenticated GET evaluate script. `url` may be absolute or a
 * same-origin path (the page context resolves relative URLs against the app).
 */
export function buildGetScript(url: string): string {
  return `
(async () => {
  ${authHeaderScript()}
  const response = await fetch(${JSON.stringify(url)}, { headers })
  let body = null
  try { body = await response.json() } catch { body = null }
  return { status: response.status, body }
})()
`.trim()
}

/** Build an authenticated POST evaluate script with a JSON body. */
export function buildPostScript(
  url: string,
  body: Record<string, unknown>
): string {
  return `
(async () => {
  ${authHeaderScript()}
  const response = await fetch(${JSON.stringify(url)}, {
    method: 'POST',
    headers,
    body: JSON.stringify(${JSON.stringify(body)})
  })
  let payload = null
  try { payload = await response.json() } catch { payload = null }
  return { status: response.status, body: payload }
})()
`.trim()
}

/**
 * Build a login evaluate script. POSTs to the public /api/auth/login endpoint,
 * then on success persists the returned JWT into `localStorage['oc_token']` and
 * the profile into `localStorage['oc_user']` — mirroring what the webapp's
 * `setToken()` + `setUser()` do. The adapter reloads the page afterwards so the
 * app boots with the new session.
 */
export function buildLoginScript(account: string, password: string): string {
  return `
(async () => {
  const response = await fetch(${JSON.stringify(CATSCO_ENDPOINTS.login)}, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: ${JSON.stringify(account)}, password: ${JSON.stringify(password)} })
  })
  let body = null
  try { body = await response.json() } catch { body = null }
  if (response.status === 200 && body && body.token) {
    localStorage.setItem('oc_token', body.token)
    const user = {
      uid: body.uid,
      username: body.username,
      email: body.email,
      display_name: body.display_name,
      avatar_url: body.avatar_url,
      account_type: body.account_type
    }
    localStorage.setItem('oc_user', JSON.stringify(user))
  }
  return { status: response.status, body }
})()
`.trim()
}
