import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Persisted last-seen cursor for `catsco watch`. Keyed by topic so a restart
 * resumes where it left off and never re-fires already-seen messages.
 *
 * The state file path can be overridden with CATSCO_WATCH_STATE_FILE (used by
 * tests); otherwise it lives under ~/.opencli/sites/catsco/watch-state.json.
 */
const DEFAULT_STATE_FILE = join(homedir(), '.opencli', 'sites', 'catsco', 'watch-state.json')

export function watchStateFile(): string {
  return process.env.CATSCO_WATCH_STATE_FILE || DEFAULT_STATE_FILE
}

export interface WatchState {
  [topic: string]: { lastSeq: number }
}

export function loadWatchState(): WatchState {
  const file = watchStateFile()
  try {
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as WatchState
      return parsed && typeof parsed === 'object' ? parsed : {}
    }
  } catch {
    /* ignore corrupt/unreadable state — start fresh */
  }
  return {}
}

export function saveWatchState(state: WatchState): void {
  try {
    const file = watchStateFile()
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, JSON.stringify(state, null, 2), 'utf8')
  } catch {
    /* best-effort; a failed cursor write should never crash the watcher */
  }
}

export function getLastSeq(state: WatchState, topic: string): number {
  return state[topic]?.lastSeq ?? -1
}

export function setLastSeq(state: WatchState, topic: string, seq: number): void {
  state[topic] = { lastSeq: seq }
}

export interface SeqLike {
  seq_id?: number
}

/** Highest seq_id in a batch (0 when empty). */
export function maxSeq(messages: SeqLike[]): number {
  return messages.reduce((max, m) => Math.max(max, Number(m.seq_id ?? 0)), 0)
}

/** Messages whose seq_id is strictly newer than `lastSeq` (input should be ascending). */
export function diffNewMessages<T extends SeqLike>(messages: T[], lastSeq: number): T[] {
  return messages.filter((m) => Number(m.seq_id ?? 0) > lastSeq)
}
