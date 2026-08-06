import { beforeEach, describe, expect, it, vi } from 'vitest'

const cliMock = vi.fn()

vi.mock('@jackwener/opencli/registry', () => ({
  Strategy: { COOKIE: 'cookie' },
  cli: cliMock
}))

vi.mock('@jackwener/opencli/errors', () => ({
  ArgumentError: class ArgumentError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'ArgumentError'
    }
  }
}))

async function load(name: string): Promise<any> {
  cliMock.mockReset()
  vi.resetModules()
  await import(`../../${name}.ts`)
  return cliMock.mock.calls[0][0]
}

describe('catsco-friends', () => {
  let config: any
  beforeEach(async () => {
    config = await load('catsco-friends')
  })

  it('registers as read and returns normalized friends', async () => {
    expect(config.name).toBe('friends')
    expect(config.access).toBe('read')
    const page = {
      evaluate: vi.fn(async (_script?: unknown) => ({
        status: 200,
        body: { friends: [{ id: 363, username: 'Yii', display_name: 'Y' }] }
      }))
    }
    const result = await config.func(page, {})
    expect(result[0]).toMatchObject({ uid: '363', username: 'Yii', displayName: 'Y' })
  })
})

describe('catsco-user-search', () => {
  let config: any
  beforeEach(async () => {
    config = await load('catsco-user-search')
  })

  it('builds the search URL and returns users', async () => {
    const page = {
      evaluate: vi.fn(async (_script?: unknown) => ({
        status: 200,
        body: { users: [{ id: 504, username: 'pi_dal_tmp_probe', display_name: 'probe' }] }
      }))
    }
    const result = await config.func(page, { query: 'pi', mode: 'name' })
    const script = page.evaluate.mock.calls[0][0] as unknown as string
    expect(script).toContain('/api/users/search?q=pi&mode=name')
    expect(result[0]).toMatchObject({ uid: '504', username: 'pi_dal_tmp_probe' })
  })
})

describe('catsco-friend-request', () => {
  let config: any
  beforeEach(async () => {
    config = await load('catsco-friend-request')
  })

  it('posts user_id + message and returns the action row', async () => {
    const page = {
      evaluate: vi.fn(async (_script?: unknown) => ({ status: 200, body: { id: 7, status: 'pending' } }))
    }
    const result = await config.func(page, { user: '504', message: 'hi' })
    const script = page.evaluate.mock.calls[0][0] as unknown as string
    expect(script).toContain('"user_id":504')
    expect(script).toContain('"message":"hi"')
    expect(result).toMatchObject({ id: '7', status: 'pending' })
  })
})

describe('catsco-group-invite', () => {
  let config: any
  beforeEach(async () => {
    config = await load('catsco-group-invite')
  })

  it('posts group_id and parsed user_ids', async () => {
    const page = {
      evaluate: vi.fn(async (_script?: unknown) => ({ status: 200, body: { added: 2, requested: 0 } }))
    }
    const result = await config.func(page, { group: '1341', users: '42,574' })
    const script = page.evaluate.mock.calls[0][0] as unknown as string
    expect(script).toContain('"group_id":1341')
    expect(script).toContain('"user_ids":[42,574]')
    expect(result).toMatchObject({ added: 2, requested: 0 })
  })

  it('throws when no valid user ids', async () => {
    await expect(config.func({}, { group: '1', users: 'abc' })).rejects.toThrow('at least one user id')
  })
})

describe('catsco-groups', () => {
  let config: any
  beforeEach(async () => {
    config = await load('catsco-groups')
  })

  it('returns normalized groups', async () => {
    const page = {
      evaluate: vi.fn(async (_script?: unknown) => ({
        status: 200,
        body: {
          groups: [{ id: 1341, name: 'g', kind: 'agent_task', member_count: 2, has_bot: true, owner_id: 275, agent_ids: [574] }]
        }
      }))
    }
    const result = await config.func(page, {})
    expect(result[0]).toMatchObject({ id: '1341', kind: 'agent_task', memberCount: 2, hasBot: true, agentIds: '574' })
  })
})
