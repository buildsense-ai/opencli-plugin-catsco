import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { getReceipt, loadReceipts, recordReceipt, receiptKey, saveReceipts, sha256Hex } from '../../src/lib/receipt'

const file = join(mkdtempSync(join(tmpdir(), 'catsco-receipt-')), 'receipts.json')

afterEach(() => {
  rmSync(join(file, '..'), { recursive: true, force: true })
  delete process.env.CATSCO_RECEIPT_FILE
})

const sample = {
  messageId: '517999',
  topicId: 'grp_1258',
  clientMsgId: 'loop:42',
  seqId: '517999',
  duplicate: false,
  contentDigest: 'abc',
  recordedAt: '2026-08-04T00:00:00Z'
}

describe('receipt registry', () => {
  it('records and retrieves a receipt by topic + clientMsgId', () => {
    process.env.CATSCO_RECEIPT_FILE = file
    recordReceipt(sample)
    expect(getReceipt('grp_1258', 'loop:42')).toMatchObject({ seqId: '517999' })
    expect(getReceipt('grp_1258', 'other')).toBeUndefined()
  })

  it('keys on topic and clientMsgId', () => {
    expect(receiptKey('t1', 'c1')).toBe('t1::c1')
  })

  it('returns empty registry when the file is missing', () => {
    process.env.CATSCO_RECEIPT_FILE = join(tmpdir(), 'catsco-no-file.json')
    expect(loadReceipts()).toEqual({})
  })

  it('persists across reload', () => {
    process.env.CATSCO_RECEIPT_FILE = file
    const registry = loadReceipts()
    registry['x::y'] = sample
    saveReceipts(registry)
    expect(loadReceipts()['x::y'].clientMsgId).toBe('loop:42')
  })
})

describe('sha256Hex', () => {
  it('is deterministic', () => {
    expect(sha256Hex('hello')).toBe(sha256Hex('hello'))
    expect(sha256Hex('hello')).toMatch(/^[0-9a-f]{64}$/)
  })
})
