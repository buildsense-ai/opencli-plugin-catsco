import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  diffNewMessages,
  getLastSeq,
  loadWatchState,
  maxSeq,
  saveWatchState,
  setLastSeq
} from '../../src/lib/watch'

const stateFile = join(mkdtempSync(join(tmpdir(), 'catsco-watch-')), 'watch-state.json')

afterEach(() => {
  rmSync(join(stateFile, '..'), { recursive: true, force: true })
  delete process.env.CATSCO_WATCH_STATE_FILE
})

describe('watch cursor helpers', () => {
  it('maxSeq returns the highest seq_id', () => {
    expect(maxSeq([{ seq_id: 1 }, { seq_id: 5 }, { seq_id: 3 }])).toBe(5)
    expect(maxSeq([])).toBe(0)
  })

  it('diffNewMessages returns only messages newer than lastSeq', () => {
    const msgs = [{ seq_id: 1 }, { seq_id: 2 }, { seq_id: 5 }]
    expect(diffNewMessages(msgs, 2)).toEqual([{ seq_id: 5 }])
    expect(diffNewMessages(msgs, 5)).toEqual([])
  })
})

describe('watch cursor persistence', () => {
  it('persists and restores the last-seen seq per topic', () => {
    process.env.CATSCO_WATCH_STATE_FILE = stateFile

    const state = loadWatchState()
    expect(getLastSeq(state, 'p2p_275_574')).toBe(-1)

    setLastSeq(state, 'p2p_275_574', 518558)
    setLastSeq(state, 'grp_1258', 517902)
    saveWatchState(state)

    const reloaded = loadWatchState()
    expect(getLastSeq(reloaded, 'p2p_275_574')).toBe(518558)
    expect(getLastSeq(reloaded, 'grp_1258')).toBe(517902)
    expect(getLastSeq(reloaded, 'unknown_topic')).toBe(-1)
  })

  it('returns empty state when the file is missing', () => {
    process.env.CATSCO_WATCH_STATE_FILE = join(tmpdir(), 'catsco-does-not-exist.json')
    expect(loadWatchState()).toEqual({})
  })
})
