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

describe('catsco-group-create', () => {
  let config: any
  beforeEach(async () => {
    config = await load('catsco-group-create')
  })

  it('creates a standard collaboration group with parsed member ids', async () => {
    const page = {
      evaluate: vi.fn(async (_script?: unknown) => ({
        status: 200,
        body: { group_id: 1400, topic: 'grp_1400', name: 'Loop: docs', kind: 'standard', member_count: 3, agent_ids: [574, 559] }
      }))
    }
    const result = await config.func(page, { name: 'Loop: docs', members: '574,559' })
    const script = page.evaluate.mock.calls[0][0] as unknown as string
    expect(script).toContain('/api/groups/create')
    expect(script).toContain('"member_ids":[574,559]')
    expect(script).toContain('"kind":"standard"')
    expect(result).toMatchObject({ groupId: '1400', topic: 'grp_1400', memberCount: 3, agentIds: '574,559' })
  })

  it('creates a single-Worker agent task group', async () => {
    const page = {
      evaluate: vi.fn(async (_script?: unknown) => ({
        status: 200,
        body: { group_id: 1401, topic: 'grp_1401', name: 'Loop: attempt', kind: 'agent_task', member_count: 2, agent_ids: [559] }
      }))
    }
    const result = await config.func(page, { name: 'Loop: attempt', members: '559', kind: 'agent_task' })
    const script = page.evaluate.mock.calls[0][0] as unknown as string
    expect(script).toContain('"member_ids":[559]')
    expect(script).toContain('"kind":"agent_task"')
    expect(result).toMatchObject({ groupId: '1401', topic: 'grp_1401', kind: 'agent_task', agentIds: '559' })
  })

  it('rejects an empty group name, invalid members, or invalid agent-task topology', async () => {
    await expect(config.func({}, { name: ' ', members: '574' })).rejects.toThrow('group name')
    await expect(config.func({}, { name: 'Loop', members: 'none' })).rejects.toThrow('member id')
    await expect(config.func({}, { name: 'Loop', members: '574,invalid,559' })).rejects.toThrow('member id')
    await expect(config.func({}, { name: 'Loop', members: '559,574', kind: 'agent_task' })).rejects.toThrow('exactly one Agent')
    await expect(config.func({}, { name: 'Loop', members: '559', kind: 'unknown' })).rejects.toThrow('group kind')
  })
})

describe('catsco-group-info', () => {
  let config: any
  beforeEach(async () => {
    config = await load('catsco-group-info')
  })

  it('returns exact group kind, topic, agents, and member ids for verification', async () => {
    const page = {
      evaluate: vi.fn(async (_script?: unknown) => ({ status: 200, body: {
        group: { id: 1400, name: 'Loop', kind: 'standard', member_count: 3, agent_ids: [574, 559] },
        members: [{ user_id: 275, role: 'owner' }, { user_id: 574, role: 'member', is_bot: true }, { user_id: 559, role: 'member', is_bot: true }]
      } }))
    }
    const result = await config.func(page, { group: '1400' })
    const script = page.evaluate.mock.calls[0][0] as unknown as string
    expect(script).toContain('/api/groups/info?id=1400')
    expect(result).toMatchObject({ groupId: '1400', topic: 'grp_1400', kind: 'standard', agentIds: '574,559', memberIds: '275,574,559' })
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

  it('throws when any user id is invalid', async () => {
    await expect(config.func({}, { group: '1', users: 'abc' })).rejects.toThrow('user id')
    await expect(config.func({}, { group: '1', users: '42,nope,574' })).rejects.toThrow('user id')
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
