import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Local receipt registry for idempotent sends.
 *
 * The CatsCo backend deduplicates on `(topic_id, from_uid, client_msg_id)` and
 * returns `duplicate` on re-send, but it does not expose `client_msg_id` in the
 * message-history response — so there is no server-side "look up by client id"
 * endpoint. This registry records what THIS CLI has sent (keyed by
 * `topic::clientMsgId`), which lets a Controller reconcile after a network
 * timeout: if the key is here, the send was acknowledged with a stable seq.
 *
 * Path overridable with CATSCO_RECEIPT_FILE (used by tests).
 */

const DEFAULT_RECEIPT_FILE = join(homedir(), '.opencli', 'sites', 'catsco', 'receipts.json')

export function receiptFile(): string {
  return process.env.CATSCO_RECEIPT_FILE || DEFAULT_RECEIPT_FILE
}

export interface SendReceipt {
  messageId: string
  topicId: string
  clientMsgId: string
  seqId: string
  duplicate: boolean
  contentDigest: string
  recordedAt: string
}

export type ReceiptRegistry = Record<string, SendReceipt>

export function receiptKey(topic: string, clientMsgId: string): string {
  return `${topic}::${clientMsgId}`
}

export function loadReceipts(): ReceiptRegistry {
  const file = receiptFile()
  try {
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as ReceiptRegistry
      return parsed && typeof parsed === 'object' ? parsed : {}
    }
  } catch {
    /* ignore corrupt state */
  }
  return {}
}

export function saveReceipts(registry: ReceiptRegistry): void {
  try {
    const file = receiptFile()
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, JSON.stringify(registry, null, 2), 'utf8')
  } catch {
    /* best-effort */
  }
}

export function recordReceipt(receipt: SendReceipt): void {
  const registry = loadReceipts()
  registry[receiptKey(receipt.topicId, receipt.clientMsgId)] = receipt
  saveReceipts(registry)
}

export function getReceipt(topic: string, clientMsgId: string): SendReceipt | undefined {
  return loadReceipts()[receiptKey(topic, clientMsgId)]
}

/** sha256 hex digest of a string (used for contentDigest). */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}
