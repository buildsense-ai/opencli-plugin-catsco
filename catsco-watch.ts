import { spawn } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { ArgumentError } from '@jackwener/opencli/errors'
import { Strategy, cli } from '@jackwener/opencli/registry'

import {
  CATSCO_APP_URL,
  CATSCO_DOMAIN,
  CATSCO_ENDPOINTS,
  buildGetScript
} from './src/lib/api'
import { unwrapApi } from './src/lib/normalize'
import {
  diffNewMessages,
  getLastSeq,
  loadWatchState,
  maxSeq,
  saveWatchState,
  setLastSeq
} from './src/lib/watch'

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

interface RawMsg {
  seq_id?: number
  from?: string
  from_uid?: number
  content?: string
  created_at?: string
  type?: string
}

interface HookOptions {
  webhook: string
  command: string
  log: string
}

function messagesUrl(topic: string, limit: number): string {
  return `${CATSCO_ENDPOINTS.messages}?topic_id=${encodeURIComponent(topic)}&limit=${limit}&offset=0&latest=1`
}

function isSelf(message: RawMsg, myUid: number): boolean {
  if (message.from_uid != null) return Number(message.from_uid) === myUid
  return String(message.from ?? '').endsWith(String(myUid))
}

/** Append a timestamped line recording a detected message to `file` (best-effort). */
function appendLogLine(file: string, topic: string, message: RawMsg, firedAt: string): void {
  try {
    appendFileSync(
      file,
      `[${firedAt}] topic=${topic} seq=${message.seq_id} from=${message.from} msg_time=${message.created_at}: ${message.content}\n`,
      'utf8'
    )
  } catch {
    /* best-effort; a failed log write should never crash the watcher */
  }
}

async function fireHook(topic: string, message: RawMsg, opts: HookOptions): Promise<void> {
  const firedAt = new Date().toISOString()
  const payload = {
    topic_id: topic,
    seq_id: message.seq_id,
    from: message.from,
    from_uid: message.from_uid,
    content: message.content,
    type: message.type,
    created_at: message.created_at,
    fired_at: firedAt
  }

  if (opts.log) appendLogLine(opts.log, topic, message, firedAt)

  if (opts.webhook) {
    let res: Response
    try {
      res = await fetch(opts.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    } catch (error) {
      console.error(`[catsco watch] webhook request failed: ${(error as Error).message}`)
      return
    }
    if (!res.ok) console.error(`[catsco watch] webhook returned HTTP ${res.status}`)
    return
  }

  if (opts.command) {
    await new Promise<void>((resolve) => {
      const child = spawn(opts.command, {
        shell: true,
        stdio: 'inherit',
        timeout: 60_000,
        env: {
          ...process.env,
          CATSCO_TOPIC: topic,
          CATSCO_SEQ: String(message.seq_id ?? ''),
          CATSCO_FROM: String(message.from ?? ''),
          CATSCO_MESSAGE: String(message.content ?? ''),
          CATSCO_CREATED_AT: String(message.created_at ?? ''),
          CATSCO_FIRED_AT: firedAt,
          CATSCO_JSON: JSON.stringify(payload)
        }
      })
      child.on('error', (error) => {
        console.error(`[catsco watch] command failed: ${error.message}`)
        resolve()
      })
      child.on('close', () => resolve())
    })
    return
  }

  // Default action: print the new message (tail -f style).
  const who = message.from ?? '?'
  console.log(`[${message.seq_id}] ${who}: ${message.content ?? ''}`)
}

cli({
  site: 'catsco',
  name: 'watch',
  description:
    'CatsCo watch a topic — poll for new agent messages and fire a hook (webhook, command, or stdout)',
  access: 'read',
  domain: CATSCO_DOMAIN,
  navigateBefore: CATSCO_APP_URL,
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'topic', positional: true, required: true, help: 'Conversation topic id, e.g. p2p_275_574' },
    { name: 'once', type: 'boolean', help: 'Poll once and exit (default false = poll until --timeout)' },
    { name: 'timeout', type: 'number', default: 3600, help: 'Total runtime in seconds for resident polling (default 3600)' },
    { name: 'interval', type: 'number', help: 'Poll interval in ms (default 5000)' },
    { name: 'limit', type: 'number', help: 'Latest messages to fetch per poll (default 100)' },
    { name: 'webhook', help: 'POST each new message as JSON to this URL' },
    { name: 'command', help: 'Run this shell command per new message (see CATSCO_* env vars)' },
    { name: 'log', help: 'Append a timestamped line per new message to this file' },
    { name: 'since', type: 'number', help: 'Start from this seqId (default: resume saved cursor or latest)' },
    { name: 'from-start', type: 'boolean', help: 'Fire for all existing messages on the first run' },
    { name: 'mine', type: 'boolean', help: 'Also fire on your own sent messages (default skips them)' }
  ],
  columns: ['seqId', 'from', 'content', 'createdAt'],
  func: async (page: any, kwargs: any) => {
    const topic = String(kwargs.topic)
    const once = Boolean(kwargs.once)
    const timeoutSec = Number(kwargs.timeout ?? 3600)
    const interval = Math.max(1000, Number(kwargs.interval ?? 5000))
    const limit = Math.max(1, Number(kwargs.limit ?? 100))
    const webhook = kwargs.webhook ? String(kwargs.webhook) : ''
    const command = kwargs.command ? String(kwargs.command) : ''
    const log = kwargs.log ? String(kwargs.log) : ''
    const fromStart = Boolean(kwargs['from-start'])
    const includeMine = Boolean(kwargs.mine)

    if (webhook && command) {
      throw new ArgumentError('use only one of --webhook or --command')
    }

    // Resolve the current user so we can skip our own sent messages.
    const meEnvelope = await page.evaluate(buildGetScript(CATSCO_ENDPOINTS.me))
    const meBody = unwrapApi<{ uid?: number }>(meEnvelope)
    const myUid = Number(meBody?.uid ?? 0)

    const state = loadWatchState()
    let lastSeq = kwargs.since != null ? Number(kwargs.since) : getLastSeq(state, topic)

    // First run: default to the newest message so we only fire on future ones.
    if (lastSeq < 0) {
      const initEnvelope = await page.evaluate(buildGetScript(messagesUrl(topic, limit)))
      const initBody = unwrapApi<{ messages?: RawMsg[] }>(initEnvelope)
      lastSeq = fromStart ? 0 : maxSeq(initBody?.messages ?? [])
      setLastSeq(state, topic, lastSeq)
      saveWatchState(state)
    }

    const seen: Array<{ seqId: number; from: string; content: string; createdAt: string }> = []
    const deadline = Date.now() + Math.max(1, timeoutSec) * 1000 - 5000

    const pollOnce = async (): Promise<void> => {
      const envelope = await page.evaluate(buildGetScript(messagesUrl(topic, limit)))
      const body = unwrapApi<{ messages?: RawMsg[] }>(envelope)
      const fresh = diffNewMessages(body?.messages ?? [], lastSeq)

      let max = lastSeq
      for (const message of fresh) {
        const seq = Number(message.seq_id ?? 0)
        if (seq > max) max = seq
        if (isSelf(message, myUid) && !includeMine) continue
        await fireHook(topic, message, { webhook, command, log })
        seen.push({
          seqId: seq,
          from: String(message.from ?? ''),
          content: String(message.content ?? ''),
          createdAt: String(message.created_at ?? '')
        })
      }

      if (max > lastSeq) {
        lastSeq = max
        setLastSeq(state, topic, lastSeq)
        saveWatchState(state)
      }
    }

    await pollOnce()
    if (once) return seen

    // Resident polling: keep the browser lease alive until the timeout deadline.
    let consecutiveFailures = 0
    while (Date.now() < deadline) {
      await sleep(interval)
      try {
        await pollOnce()
        consecutiveFailures = 0
      } catch (error) {
        consecutiveFailures += 1
        console.error(`[catsco watch] poll failed (${consecutiveFailures}/3): ${(error as Error).message}`)
        if (consecutiveFailures >= 3) throw error
      }
    }

    return seen
  }
})
