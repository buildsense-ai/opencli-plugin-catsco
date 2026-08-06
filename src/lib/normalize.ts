import { AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors'

import { CATSCO_DOMAIN } from './api'

/**
 * Envelope returned by every evaluate script in `api.ts`.
 * Adapters pass this through `unwrapApi` to surface typed errors.
 */
export interface ApiEnvelope {
  status: number
  body: unknown
}

/**
 * Map an API envelope to typed errors:
 * - 401/403 → AuthRequiredError (tell the user to log into app.catsco.cc)
 * - other >=400 → CommandExecutionError (surface the API `error` field)
 * - otherwise → return the decoded body
 */
export function unwrapApi<T>(envelope: ApiEnvelope): T {
  const { status, body } = envelope

  if (status === 401 || status === 403) {
    throw new AuthRequiredError(
      CATSCO_DOMAIN,
      'CatsCo requires a logged-in session — open app.catsco.cc in Chrome and sign in.'
    )
  }

  if (status >= 400) {
    const message =
      (body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : '') || `CatsCo API returned HTTP ${status}`
    throw new CommandExecutionError(message)
  }

  return body as T
}

/** Extract a `{ listKey: [...] }` envelope body into a typed array. */
export function extractList<T>(body: unknown, listKey: string): T[] {
  if (Array.isArray(body)) return body as T[]
  if (body && typeof body === 'object' && Array.isArray((body as Record<string, unknown>)[listKey])) {
    return (body as Record<string, T[]>)[listKey]
  }
  return []
}

function str(value: unknown): string {
  return value == null ? '' : String(value)
}

/** Render message content: objects are JSON-stringified back to their stored form. */
export function contentString(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function bool(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}

// ---- Raw entity types (subset of the CatsCo API) --------------------------

export interface RawProject {
  id?: number
  owner_uid?: number
  name?: string
  task_count?: number
  created_at?: string
  updated_at?: string
}

export interface RawGroup {
  id?: number
  name?: string
  owner_id?: number
  kind?: string
  avatar_url?: string
  has_bot?: boolean
  member_count?: number
  agent_ids?: number[]
  max_members?: number
  created_at?: string
}

export interface RawUser {
  account_type?: string
  avatar_url?: string
  created_at?: string
  display_name?: string
  email?: string
  id?: number
  uid?: number
  username?: string
}

export interface RawAgent {
  id?: number
  uid?: number
  username?: string
  display_name?: string
  avatar_url?: string
  relation?: string
  topic_id?: string
  is_bot?: boolean
  is_online?: boolean
  visibility?: string
  cloud_artifacts_enabled?: boolean
}

export interface RawTaskStatus {
  topic_id?: string
  run_id?: string
  state?: string
  summary?: string
  error?: string
  source_uid?: number
  updated_at?: string
}

export interface RawConversation {
  id?: string
  name?: string
  preview?: string
  is_group?: boolean
  group_id?: number
  has_bot?: boolean
  is_agent_task?: boolean
  member_count?: number
  agent_ids?: number[]
  last_time?: string
  latest_seq?: number
  project_id?: number
  project_name?: string
  task_status?: RawTaskStatus
}

export interface RawMessage {
  content?: string
  created_at?: string
  from?: string
  from_uid?: number
  id?: number
  seq_id?: number
  topic_id?: string
  type?: string
  msg_type?: string
  mode?: string
}

export interface RawAgentEntry {
  id?: number
  scene_key?: string
  channel?: string
  channel_app_id?: string
  access_mode?: string
  status?: string
  created_at?: string
  [key: string]: unknown
}

export interface RawArtifact {
  id?: number | string
  name?: string
  status?: string
  size?: number
  created_at?: string
  [key: string]: unknown
}
// ---- Normalized output rows (keys must match `columns` 1:1) ----------------

export interface UserRow {
  uid: string
  username: string
  email: string
  displayName: string
  accountType: string
  createdAt: string
}

export interface AgentRow {
  uid: string
  displayName: string
  username: string
  relation: string
  online: boolean
  topicId: string
  visibility: string
}

export interface ConversationRow {
  topicId: string
  name: string
  preview: string
  isAgentTask: boolean
  memberCount: number
  lastTime: string
  taskState: string
}

export interface MessageRow {
  seqId: number
  type: string
  from: string
  content: string
  createdAt: string
}

export interface AgentEntryRow {
  id: string
  channel: string
  sceneKey: string
  accessMode: string
  status: string
}

export interface ArtifactRow {
  id: string
  name: string
  status: string
  size: string
}

export interface ProjectRow {
  id: string
  name: string
  taskCount: number
  ownerUid: string
  createdAt: string
  updatedAt: string
}

export interface GroupRow {
  id: string
  name: string
  kind: string
  memberCount: number
  hasBot: boolean
  ownerId: string
  agentIds: string
}

export interface FriendActionRow {
  id: string
  status: string
}

export interface OpenRow {
  agentUid: string
  displayName: string
  topic: string
}

export interface SendRow {
  topicId: string
  seqId: string
  type: string
  content: string
}

// ---- Normalizers -----------------------------------------------------------

export function normalizeUser(raw: RawUser): UserRow {
  return {
    uid: str(raw.uid),
    username: str(raw.username),
    email: str(raw.email),
    displayName: str(raw.display_name),
    accountType: str(raw.account_type),
    createdAt: str(raw.created_at)
  }
}

export function normalizeAgent(raw: RawAgent): AgentRow {
  return {
    uid: str(raw.uid ?? raw.id),
    displayName: str(raw.display_name || raw.username),
    username: str(raw.username),
    relation: str(raw.relation),
    online: bool(raw.is_online),
    topicId: str(raw.topic_id),
    visibility: str(raw.visibility)
  }
}

export function normalizeConversation(raw: RawConversation): ConversationRow {
  return {
    topicId: str(raw.id),
    name: str(raw.name),
    preview: str(raw.preview),
    isAgentTask: bool(raw.is_agent_task),
    memberCount: Number(raw.member_count ?? 0),
    lastTime: str(raw.last_time),
    taskState: str(raw.task_status?.state)
  }
}

export function normalizeMessage(raw: RawMessage): MessageRow {
  return {
    seqId: Number(raw.seq_id ?? raw.id ?? 0),
    type: str(raw.type || raw.msg_type),
    from: str(raw.from),
    content: contentString(raw.content),
    createdAt: str(raw.created_at)
  }
}

export function normalizeAgentEntry(raw: RawAgentEntry): AgentEntryRow {
  return {
    id: str(raw.id),
    channel: str(raw.channel),
    sceneKey: str(raw.scene_key),
    accessMode: str(raw.access_mode),
    status: str(raw.status)
  }
}

export function normalizeArtifact(raw: RawArtifact): ArtifactRow {
  return {
    id: str(raw.id),
    name: str(raw.name),
    status: str(raw.status),
    size: raw.size == null ? '' : String(raw.size)
  }
}

export function normalizeProject(raw: RawProject): ProjectRow {
  return {
    id: str(raw.id),
    name: str(raw.name),
    taskCount: Number(raw.task_count ?? 0),
    ownerUid: str(raw.owner_uid),
    createdAt: str(raw.created_at),
    updatedAt: str(raw.updated_at)
  }
}

export function normalizeGroup(raw: RawGroup): GroupRow {
  return {
    id: str(raw.id),
    name: str(raw.name),
    kind: str(raw.kind),
    memberCount: Number(raw.member_count ?? 0),
    hasBot: bool(raw.has_bot),
    ownerId: str(raw.owner_id),
    agentIds: Array.isArray(raw.agent_ids) ? raw.agent_ids.join(',') : ''
  }
}

export function normalizeFriendAction(body: unknown): FriendActionRow {
  const raw = (body && typeof body === 'object' ? body : {}) as { id?: number; status?: string }
  return {
    id: str(raw.id),
    status: str(raw.status)
  }
}

export function normalizeUserRow(raw: RawUser): UserRow {
  return {
    uid: str(raw.uid ?? raw.id),
    username: str(raw.username),
    email: str(raw.email),
    displayName: str(raw.display_name),
    accountType: str(raw.account_type),
    createdAt: str(raw.created_at)
  }
}

export function normalizeOpen(body: unknown): OpenRow {
  const { agent, topic } = (body && typeof body === 'object' ? body : {}) as {
    agent?: RawAgent
    topic?: string
  }
  return {
    agentUid: str(agent?.uid ?? agent?.id),
    displayName: str(agent?.display_name || agent?.username),
    topic: str(topic)
  }
}

export function normalizeSend(body: unknown): SendRow {
  const raw = (body && typeof body === 'object' ? body : {}) as {
    topic_id?: string
    seq_id?: number
    id?: number
    type?: string
    content?: string
  }
  return {
    topicId: str(raw.topic_id),
    seqId: str(raw.seq_id ?? raw.id),
    type: str(raw.type),
    content: str(raw.content)
  }
}
