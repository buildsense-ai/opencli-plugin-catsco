import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const cliMock = vi.fn()

vi.mock('@jackwener/opencli/registry', () => ({
  Strategy: {
    COOKIE: 'cookie'
  },
  cli: cliMock
}))

vi.mock('@jackwener/opencli/errors', () => ({
  AuthRequiredError: class AuthRequiredError extends Error {
    constructor(domain: string, message?: string) {
      super(message || `auth required for ${domain}`)
      this.name = 'AuthRequiredError'
    }
  },
  ArgumentError: class ArgumentError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'ArgumentError'
    }
  },
  CommandExecutionError: class CommandExecutionError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'CommandExecutionError'
    }
  }
}))

async function load(name: string): Promise<any> {
  cliMock.mockReset()
  vi.resetModules()
  await import(`../../${name}.ts`)
  return cliMock.mock.calls[0][0]
}

describe('catsco-agents', () => {
  let config: any

  beforeEach(async () => {
    config = await load('catsco-agents')
  })

  it('registers the agents command with cookie strategy and browser', () => {
    expect(config.site).toBe('catsco')
    expect(config.name).toBe('agents')
    expect(config.domain).toBe('app.catsco.cc')
    expect(config.strategy).toBe('cookie')
    expect(config.browser).toBe(true)
    expect(config.navigateBefore).toBe('https://app.catsco.cc/')
    expect(config.columns).toEqual(['uid', 'displayName', 'username', 'relation', 'online', 'topicId', 'visibility'])
  })

  it('returns normalized agents from the API envelope', async () => {
    const page = {
      evaluate: vi.fn(async () => ({
        status: 200,
        body: {
          agents: [
            { uid: 574, display_name: 'Abraxas', username: 'bot-abraxas', relation: 'owner', is_online: true, topic_id: 'p2p_275_574', visibility: 'private' }
          ]
        }
      }))
    }
    const result = await config.func(page, {})
    expect(page.evaluate).toHaveBeenCalled()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ uid: '574', displayName: 'Abraxas', online: true })
  })
})

describe('catsco-messages', () => {
  let config: any

  beforeEach(async () => {
    config = await load('catsco-messages')
  })

  it('registers the messages command with a required positional topic', () => {
    expect(config.name).toBe('messages')
    expect(config.args[0]).toMatchObject({ name: 'topic', positional: true, required: true })
  })

  it('builds the topic query URL and returns normalized messages', async () => {
    const page = {
      evaluate: vi.fn(async (_script?: unknown) => ({
        status: 200,
        body: {
          messages: [{ seq_id: 517898, type: 'text', from: 'usr275', content: 'hi', created_at: '2026-08-04T00:44:55Z' }]
        }
      }))
    }
    const result = await config.func(page, { topic: 'grp_1258', limit: 5 })
    const script = page.evaluate.mock.calls[0][0] as unknown as string
    expect(script).toContain('/api/messages?topic_id=grp_1258&limit=5&offset=0')
    expect(result[0]).toMatchObject({ seqId: 517898, content: 'hi' })
  })
})

describe('catsco-send', () => {
  let config: any

  beforeEach(async () => {
    config = await load('catsco-send')
  })

  it('registers the send command as write access', () => {
    expect(config.name).toBe('send')
    expect(config.access).toBe('write')
    expect(config.defaultFormat).toBe('plain')
  })

  it('throws ArgumentError on empty content', async () => {
    await expect(config.func({}, { topic: 'grp_1258', content: '   ' })).rejects.toThrow('content cannot be empty')
  })

  it('posts a text message and returns the SendRow', async () => {
    const page = {
      evaluate: vi.fn(async (_script?: unknown) => ({
        status: 200,
        body: { topic_id: 'grp_1258', seq_id: 517999, type: 'text', content: 'hello' }
      }))
    }
    const result = await config.func(page, { topic: 'grp_1258', content: 'hello' })
    const script = page.evaluate.mock.calls[0][0] as unknown as string
    expect(script).toContain("method: 'POST'")
    expect(script).toContain('"topic_id":"grp_1258"')
    expect(result[0]).toMatchObject({ topicId: 'grp_1258', content: 'hello' })
  })
})

describe('catsco-open', () => {
  let config: any

  beforeEach(async () => {
    config = await load('catsco-open')
  })

  it('registers open and maps the agent + topic response', async () => {
    expect(config.name).toBe('open')
    expect(config.access).toBe('write')

    const page = {
      evaluate: vi.fn(async () => ({
        status: 200,
        body: { agent: { uid: 574, display_name: 'Abraxas' }, topic: 'p2p_275_574' }
      }))
    }
    const result = await config.func(page, { agent: '574' })
    expect(result[0]).toMatchObject({ agentUid: '574', displayName: 'Abraxas', topic: 'p2p_275_574' })
  })
})

describe('catsco-me', () => {
  let config: any

  beforeEach(async () => {
    config = await load('catsco-me')
  })

  it('returns a single normalized user row', async () => {
    const page = {
      evaluate: vi.fn(async () => ({
        status: 200,
        body: { uid: 275, username: 'pi-dal', email: 'hi@pi-dal.com', account_type: 'human', created_at: 'x' }
      }))
    }
    const result = await config.func(page, {})
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ uid: '275', username: 'pi-dal' })
  })
})

describe('catsco-login', () => {
  let config: any
  const savedEnv = process.env.CATSCO_PASSWORD

  beforeEach(async () => {
    config = await load('catsco-login')
  })

  afterEach(() => {
    if (savedEnv === undefined) delete process.env.CATSCO_PASSWORD
    else process.env.CATSCO_PASSWORD = savedEnv
  })

  it('registers the login command as write access', () => {
    expect(config.name).toBe('login')
    expect(config.access).toBe('write')
    expect(config.args[0]).toMatchObject({ name: 'account', positional: true, required: true })
    expect(config.args[1]).toMatchObject({ name: 'password' })
  })

  it('throws ArgumentError when no password is provided', async () => {
    delete process.env.CATSCO_PASSWORD
    await expect(config.func({}, { account: 'pi-dal' })).rejects.toThrow('password required')
  })

  it('throws AuthRequiredError with the API detail on bad credentials', async () => {
    const page = {
      evaluate: vi.fn(async () => ({ status: 401, body: { error: 'password mismatch' } }))
    }
    await expect(config.func(page, { account: 'pi-dal', password: 'wrong' })).rejects.toThrow('password mismatch')
  })

  it('persists the session and reloads the app on success', async () => {
    let call = 0
    const page = {
      evaluate: vi.fn(async (_script?: unknown) => {
        call += 1
        if (call === 1) {
          return { status: 200, body: { token: 'jwt-abc', uid: 275, username: 'pi-dal', email: 'hi@pi-dal.com', account_type: 'human' } }
        }
        return { status: 200, body: { uid: 275, username: 'pi-dal', email: 'hi@pi-dal.com', account_type: 'human' } }
      }),
      goto: vi.fn(async () => {})
    }
    const result = await config.func(page, { account: 'pi-dal', password: 's3cret' })
    const loginScript = page.evaluate.mock.calls[0][0] as unknown as string
    expect(loginScript).toContain('/api/auth/login')
    expect(loginScript).toContain('oc_token')
    expect(page.goto).toHaveBeenCalledWith('https://app.catsco.cc/', expect.anything())
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ uid: '275', username: 'pi-dal' })
  })
})

describe('catsco-chat', () => {
  let config: any

  beforeEach(async () => {
    config = await load('catsco-chat')
  })

  it('registers the chat command as write access', () => {
    expect(config.name).toBe('chat')
    expect(config.access).toBe('write')
    expect(config.args[0]).toMatchObject({ name: 'agent', positional: true, required: true })
    expect(config.args[1]).toMatchObject({ name: 'message', positional: true, required: true })
  })

  it('throws ArgumentError on empty message', async () => {
    await expect(config.func({}, { agent: '574', message: '   ' })).rejects.toThrow('content cannot be empty')
  })

  it('opens the agent and sends the message to its p2p topic', async () => {
    let call = 0
    const page = {
      evaluate: vi.fn(async (_script?: unknown) => {
        call += 1
        if (call === 1) {
          return { status: 200, body: { agent: { uid: 574, display_name: 'Abraxas' }, topic: 'p2p_275_574' } }
        }
        return { status: 200, body: { topic_id: 'p2p_275_574', seq_id: 518400, type: 'text', content: 'hello' } }
      })
    }
    const result = await config.func(page, { agent: '574', message: 'hello' })
    expect(page.evaluate).toHaveBeenCalledTimes(2)
    const openScript = page.evaluate.mock.calls[0][0] as unknown as string
    const sendScript = page.evaluate.mock.calls[1][0] as unknown as string
    expect(openScript).toContain('/api/agents/open')
    expect(sendScript).toContain('"topic_id":"p2p_275_574"')
    expect(result[0]).toMatchObject({ topicId: 'p2p_275_574', content: 'hello' })
  })
})

describe('catsco-watch', () => {
  let config: any
  const savedStateFile = process.env.CATSCO_WATCH_STATE_FILE

  beforeEach(async () => {
    const { rmSync } = await import('node:fs')
    process.env.CATSCO_WATCH_STATE_FILE = '/tmp/catsco-watch-test-state.json'
    rmSync('/tmp/catsco-watch-test-state.json', { force: true })
    config = await load('catsco-watch')
  })

  afterEach(() => {
    if (savedStateFile === undefined) delete process.env.CATSCO_WATCH_STATE_FILE
    else process.env.CATSCO_WATCH_STATE_FILE = savedStateFile
  })

  it('registers the watch command as read access', () => {
    expect(config.name).toBe('watch')
    expect(config.access).toBe('read')
    expect(config.args[0]).toMatchObject({ name: 'topic', positional: true, required: true })
    expect(config.args.some((a: any) => a.name === 'timeout')).toBe(true)
  })

  it('rejects both --webhook and --command', async () => {
    await expect(
      config.func({}, { topic: 't', webhook: 'http://x', command: 'echo hi', once: true })
    ).rejects.toThrow('only one of --webhook or --command')
  })

  it('returns new agent messages in --once mode and skips self', async () => {
    let call = 0
    const page = {
      evaluate: vi.fn(async (_script?: unknown) => {
        call += 1
        if (call === 1) {
          return { status: 200, body: { uid: 275 } } // /api/me
        }
        if (call === 2) {
          // init: newest seq is 4
          return { status: 200, body: { messages: [{ seq_id: 4, from: 'usr574', content: 'ok' }] } }
        }
        // poll: one new agent message (seq 5) + one self message (seq 6)
        return {
          status: 200,
          body: {
            messages: [
              { seq_id: 4, from: 'usr574', from_uid: 574, content: 'ok' },
              { seq_id: 5, from: 'usr574', from_uid: 574, content: 'done' },
              { seq_id: 6, from: 'usr275', from_uid: 275, content: 'mine' }
            ]
          }
        }
      })
    }
    const result = await config.func(page, { topic: 'p2p_275_574', once: true })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ seqId: 5, from: 'usr574', content: 'done' })
  })

  it('includes own messages when --mine is set', async () => {
    let call = 0
    const page = {
      evaluate: vi.fn(async (_script?: unknown) => {
        call += 1
        if (call === 1) return { status: 200, body: { uid: 275 } }
        if (call === 2) return { status: 200, body: { messages: [{ seq_id: 1, from: 'usr275', content: 'hi' }] } }
        return {
          status: 200,
          body: { messages: [{ seq_id: 2, from: 'usr275', from_uid: 275, content: 'mine' }] }
        }
      })
    }
    const result = await config.func(page, { topic: 't', once: true, mine: true })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ seqId: 2, content: 'mine' })
  })

  it('writes a timestamped log line when --log is set', async () => {
    const { readFileSync, rmSync } = await import('node:fs')
    const logFile = '/tmp/catsco-watch-log-test.log'
    rmSync(logFile, { force: true })

    let call = 0
    const page = {
      evaluate: vi.fn(async (_script?: unknown) => {
        call += 1
        if (call === 1) return { status: 200, body: { uid: 275 } }
        if (call === 2) return { status: 200, body: { messages: [{ seq_id: 9, from: 'usr574', content: 'old' }] } }
        return { status: 200, body: { messages: [{ seq_id: 10, from: 'usr574', content: 'hello log', created_at: '2026-08-04T03:00:00Z' }] } }
      })
    }
    await config.func(page, { topic: 't', once: true, log: logFile })

    const content = readFileSync(logFile, 'utf8')
    expect(content).toMatch(/^\[20\d\d-\d\d-\d\d/)
    expect(content).toContain('seq=10')
    expect(content).toContain('from=usr574')
    expect(content).toContain('msg_time=2026-08-04T03:00:00Z')
    expect(content).toContain('hello log')
    rmSync(logFile, { force: true })
  })
})

describe('catsco-projects', () => {
  let config: any

  beforeEach(async () => {
    config = await load('catsco-projects')
  })

  it('registers the projects command as read access', () => {
    expect(config.name).toBe('projects')
    expect(config.access).toBe('read')
    expect(config.columns).toEqual(['id', 'name', 'taskCount', 'ownerUid', 'createdAt', 'updatedAt'])
  })

  it('returns normalized projects from the API envelope', async () => {
    const page = {
      evaluate: vi.fn(async () => ({
        status: 200,
        body: {
          projects: [{ id: 24, name: '开发', task_count: 7, owner_uid: 275, created_at: '2026-07-28T00:55:37Z', updated_at: '2026-08-04T00:44:55Z' }]
        }
      }))
    }
    const result = await config.func(page, {})
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: '24', name: '开发', taskCount: 7, ownerUid: '275' })
  })
})

describe('catsco-project-sessions', () => {
  let config: any

  beforeEach(async () => {
    config = await load('catsco-project-sessions')
  })

  it('registers the project-sessions command as read access', () => {
    expect(config.name).toBe('project-sessions')
    expect(config.access).toBe('read')
    expect(config.args[0]).toMatchObject({ name: 'project', positional: true, required: true })
  })

  it('filters conversations by numeric project id', async () => {
    const page = {
      evaluate: vi.fn(async () => ({
        status: 200,
        body: {
          conversations: [
            { id: 'grp_1', name: 'a', project_id: 24, project_name: '开发', last_time: 't1', task_status: { state: 'completed' } },
            { id: 'grp_2', name: 'b', project_id: 24, project_name: '开发', last_time: 't2', task_status: { state: 'running' } },
            { id: 'grp_3', name: 'c', last_time: 't3' }
          ]
        }
      }))
    }
    const result = await config.func(page, { project: '24' })
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ topicId: 'grp_1', taskState: 'completed' })
    expect(result[1]).toMatchObject({ topicId: 'grp_2', taskState: 'running' })
  })

  it('filters conversations by project name', async () => {
    const page = {
      evaluate: vi.fn(async () => ({
        status: 200,
        body: {
          conversations: [
            { id: 'grp_1', name: 'a', project_id: 24, project_name: '开发' },
            { id: 'grp_3', name: 'c' }
          ]
        }
      }))
    }
    const result = await config.func(page, { project: '开发' })
    expect(result).toHaveLength(1)
    expect(result[0].topicId).toBe('grp_1')
  })
})
