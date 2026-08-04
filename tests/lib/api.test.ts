import { describe, expect, it } from 'vitest'

import { buildGetScript, buildLoginScript, buildPostScript } from '../../src/lib/api'

describe('buildGetScript', () => {
  it('reads the oc_token from localStorage and attaches a Bearer header', () => {
    const script = buildGetScript('/api/agents')
    expect(script).toContain("localStorage.getItem('oc_token')")
    expect(script).toContain("headers['Authorization'] = 'Bearer ' + token")
    expect(script).toContain('fetch("/api/agents"')
    expect(script).toContain('return { status: response.status, body }')
  })

  it('embeds the full URL including query parameters', () => {
    const script = buildGetScript('/api/messages?topic_id=grp_1258&limit=50&offset=0')
    expect(script).toContain('fetch("/api/messages?topic_id=grp_1258&limit=50&offset=0"')
  })

  it('tolerates non-JSON responses', () => {
    const script = buildGetScript('/api/me')
    expect(script).toContain("try { body = await response.json() } catch { body = null }")
  })
})

describe('buildPostScript', () => {
  it('sends a JSON body with the auth header', () => {
    const script = buildPostScript('/api/messages/send', {
      topic_id: 'grp_1258',
      type: 'text',
      content: 'hi'
    })
    expect(script).toContain("method: 'POST'")
    expect(script).toContain("headers['Authorization'] = 'Bearer ' + token")
    expect(script).toContain('"topic_id":"grp_1258"')
    expect(script).toContain('"content":"hi"')
  })
})

describe('buildLoginScript', () => {
  it('posts account + password to /api/auth/login', () => {
    const script = buildLoginScript('pi-dal', 's3cret')
    expect(script).toContain('fetch("/api/auth/login"')
    expect(script).toContain('pi-dal')
    expect(script).toContain('s3cret')
    expect(script).toContain("method: 'POST'")
  })

  it('persists the token and profile to localStorage on success', () => {
    const script = buildLoginScript('pi-dal', 's3cret')
    expect(script).toContain("localStorage.setItem('oc_token', body.token)")
    expect(script).toContain("localStorage.setItem('oc_user', JSON.stringify(user))")
    expect(script).toContain('response.status === 200 && body && body.token')
  })
})
