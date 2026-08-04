import { AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors'
import { describe, expect, it } from 'vitest'

import {
  extractList,
  normalizeAgent,
  normalizeConversation,
  normalizeMessage,
  normalizeOpen,
  normalizeProject,
  normalizeSend,
  normalizeUser,
  unwrapApi
} from '../../src/lib/normalize'

describe('unwrapApi', () => {
  it('throws AuthRequiredError on 401', () => {
    expect(() => unwrapApi({ status: 401, body: null })).toThrow(AuthRequiredError)
  })

  it('throws AuthRequiredError on 403', () => {
    expect(() => unwrapApi({ status: 403, body: null })).toThrow(AuthRequiredError)
  })

  it('throws CommandExecutionError with the API error message on 4xx/5xx', () => {
    try {
      unwrapApi({ status: 400, body: { error: 'unsupported channel' } })
      throw new Error('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(CommandExecutionError)
      expect((error as Error).message).toContain('unsupported channel')
    }
  })

  it('returns the body on success', () => {
    expect(unwrapApi({ status: 200, body: { uid: 275 } })).toEqual({ uid: 275 })
  })
})

describe('extractList', () => {
  it('pulls an array out of a { listKey: [...] } envelope', () => {
    expect(extractList({ agents: [{ uid: 1 }] }, 'agents')).toEqual([{ uid: 1 }])
  })

  it('passes through a bare array', () => {
    expect(extractList([{ a: 1 }], 'anything')).toEqual([{ a: 1 }])
  })

  it('returns [] when the key is missing', () => {
    expect(extractList({ conversations: [] }, 'agents')).toEqual([])
  })
})

describe('normalizeUser', () => {
  it('maps account fields', () => {
    expect(
      normalizeUser({
        uid: 275,
        username: 'pi-dal',
        email: 'hi@pi-dal.com',
        display_name: 'Pi',
        account_type: 'human',
        created_at: '2026-06-19T05:50:39Z'
      })
    ).toEqual({
      uid: '275',
      username: 'pi-dal',
      email: 'hi@pi-dal.com',
      displayName: 'Pi',
      accountType: 'human',
      createdAt: '2026-06-19T05:50:39Z'
    })
  })
})

describe('normalizeAgent', () => {
  it('maps agent fields and coerces online', () => {
    const row = normalizeAgent({
      uid: 574,
      username: 'bot-abraxas-5617',
      display_name: 'Abraxas',
      relation: 'owner',
      is_online: true,
      topic_id: 'p2p_275_574',
      visibility: 'private'
    })
    expect(row).toMatchObject({
      uid: '574',
      displayName: 'Abraxas',
      username: 'bot-abraxas-5617',
      relation: 'owner',
      online: true,
      topicId: 'p2p_275_574',
      visibility: 'private'
    })
  })
})

describe('normalizeConversation', () => {
  it('maps conversation fields and task state', () => {
    const row = normalizeConversation({
      id: 'grp_1258',
      name: 'review the build',
      preview: 'task failed',
      is_agent_task: true,
      member_count: 2,
      last_time: '2026-08-04T01:05:30Z',
      task_status: { state: 'failed' }
    })
    expect(row).toMatchObject({
      topicId: 'grp_1258',
      name: 'review the build',
      preview: 'task failed',
      isAgentTask: true,
      memberCount: 2,
      lastTime: '2026-08-04T01:05:30Z',
      taskState: 'failed'
    })
  })
})

describe('normalizeMessage', () => {
  it('maps message fields', () => {
    const row = normalizeMessage({
      seq_id: 517898,
      type: 'text',
      from: 'usr275',
      content: 'review the actions',
      created_at: '2026-08-04T00:44:55Z'
    })
    expect(row).toMatchObject({
      seqId: 517898,
      type: 'text',
      from: 'usr275',
      content: 'review the actions',
      createdAt: '2026-08-04T00:44:55Z'
    })
  })
})

describe('normalizeOpen', () => {
  it('maps the open-agent response to an OpenRow', () => {
    expect(
      normalizeOpen({ agent: { uid: 574, display_name: 'Abraxas' }, topic: 'p2p_275_574' })
    ).toEqual({ agentUid: '574', displayName: 'Abraxas', topic: 'p2p_275_574' })
  })
})

describe('normalizeSend', () => {
  it('maps the send response to a SendRow', () => {
    expect(
      normalizeSend({ topic_id: 'grp_1258', seq_id: 517999, type: 'text', content: 'hi' })
    ).toEqual({ topicId: 'grp_1258', seqId: '517999', type: 'text', content: 'hi' })
  })
})

describe('normalizeProject', () => {
  it('maps project fields', () => {
    expect(
      normalizeProject({ id: 24, name: '开发', task_count: 7, owner_uid: 275, created_at: 'c', updated_at: 'u' })
    ).toEqual({
      id: '24',
      name: '开发',
      taskCount: 7,
      ownerUid: '275',
      createdAt: 'c',
      updatedAt: 'u'
    })
  })
})
