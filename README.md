# opencli-plugin-catsco

[OpenCLI](https://github.com/jackwener/OpenCLI) plugin for **CatsCo** — the AI
agent assistant at [app.catsco.cc](https://app.catsco.cc/). It turns your
logged-in CatsCo session into a CLI you (or an agent) can drive: list agents,
inspect conversations, read messages, open an agent, and send prompts.

## Install

```bash
opencli plugin install github.com/pi-dal/opencli-plugin-catsco
# or, from a local checkout:
opencli plugin install local:/path/to/opencli-plugin-catsco
```

Requires a Chrome session logged into `app.catsco.cc` (the OpenCLI extension
must be connected — see `opencli doctor`).

## Commands

| Command | Access | Description |
|---------|--------|-------------|
| `catsco me` | read | Current user profile |
| `catsco agents` | read | List my agents (bots) with online status |
| `catsco conversations` | read | Recent conversations / agent tasks |
| `catsco projects` | read | List projects (task groups) with task counts |
| `catsco project-sessions <project>` | read | List sessions inside a project (by id or name) |
| `catsco messages <topic>` | read | Read messages in a topic (`--limit`, `--offset`) |
| `catsco entries <agent>` | read | Task entries for an agent |
| `catsco artifacts <agent>` | read | Cloud artifacts for an agent |
| `catsco open <agent>` | write | Open/select an agent, returns its conversation topic |
| `catsco chat <agent> <message>` | write | Private-chat an agent — opens it and sends a message in one step |
| `catsco watch <topic>` | read | Poll for new messages and fire a hook (`--webhook`/`--command`) |
| `catsco send <topic> <content>` | write | Send a text message to a topic |
| `catsco login <account>` | write | Log in (email/username) and persist the session to the browser |

### Examples

```bash
opencli catsco agents -f table
opencli catsco conversations -f json
opencli catsco messages grp_1258 --limit 20
opencli catsco open 574                  # -> p2p_275_574
opencli catsco chat 574 "请帮我 review 最近的提交"   # one-step agent private chat
opencli catsco send p2p_275_574 "你好"          # send to an explicit topic

# login — password via flag or CATSCO_PASSWORD env var (avoids it in shell history)
opencli catsco login pi-dal --password '…'
opencli catsco login pi-dal              # reads CATSCO_PASSWORD from the environment
```

## How it works

CatsCo authenticates with a JWT stored in `localStorage['oc_token']` (not a
cookie), sent as `Authorization: Bearer <jwt>`. Every adapter is a
browser-based (`Strategy.COOKIE`) command that runs an evaluate script inside
your authenticated page context: it reads the token from `localStorage` and
attaches it to the API call, so you stay logged in and nothing sensitive is
ever stored by the plugin.

### API surface used

| Method | Endpoint | Command |
|--------|----------|---------|
| GET | `/api/me` | `me` |
| GET | `/api/agents` | `agents` |
| GET | `/api/conversations` | `conversations` |
| GET | `/api/projects` | `projects` |

> There is no dedicated "project sessions" endpoint — `project-sessions` pulls
> `/api/conversations` and filters by the `project_id`/`project_name` the server
> attaches to each conversation.
| GET | `/api/messages?topic_id=...` | `messages` |
| GET | `/api/agent-entries?agent_uid=...` | `entries` |
| GET | `/api/agents/{id}/artifacts?status=...` | `artifacts` |
| POST | `/api/agents/open` | `open` |
| POST | `/api/messages/send` | `send` |
| POST | `/api/auth/login` | `login` |

> `createAgentEntry` (`POST /api/agent-entries`) only accepts external channels
> (`weixin` / `feishu`) for channel binding — the web "new task" flow is `open` +
> `send`, which is exactly what `chat` encapsulates.

### Login flow

`POST /api/auth/login` takes `{ account, password }` (email or username) and returns a
JWT. The `login` adapter runs that request inside the page context, writes the JWT to
`localStorage['oc_token']` and the profile to `localStorage['oc_user']` (mirroring the
webapp's own `setToken`/`setUser`), then reloads the app so it boots with the new
session. Pass the password with `--password`, or set `CATSCO_PASSWORD` so it never
appears in shell history.

### Private chat with an agent

Each agent has a private (p2p) conversation identified by a `topic_id` like
`p2p_275_574` (see `catsco agents`). `catsco chat <agent> <message>` resolves the
agent's p2p topic via `POST /api/agents/open` and sends the message in one step.
Read the agent's replies with `catsco messages <topic>`.

```bash
opencli catsco chat 574 "总结一下这个 PR"
opencli catsco messages p2p_275_574 --limit 10
```

## Watching a topic & firing a hook

`catsco watch <topic>` polls a topic for new messages and fires a hook when the
agent posts something. It resumes from a persisted per-topic cursor (last-seen
`seq_id`), so restarts never re-fire old messages.

**Hook actions** (pick one):

- `--webhook <url>` — POST each new message as JSON (`{topic_id, seq_id, from,
  from_uid, content, type, created_at, fired_at}`).
- `--command <cmd>` — run a shell command per message. The message is exposed via
  env vars: `CATSCO_MESSAGE`, `CATSCO_SEQ`, `CATSCO_FROM`, `CATSCO_TOPIC`,
  `CATSCO_CREATED_AT` (message time), `CATSCO_FIRED_AT` (when the watcher caught
  it), `CATSCO_JSON`.
- `--log <file>` — append a timestamped line per message to a file (also usable
  alongside `--webhook`/`--command`).
- neither — print the new messages (tail -f style).

**Options:** `--once` (poll once, exit), `--interval <ms>` (default 5000),
`--limit <n>`, `--since <seq>` (start cursor), `--from-start` (fire all existing),
`--mine` (also fire on your own messages — skipped by default),
`--timeout <sec>` (resident runtime, default 3600).

The cursor lives in `~/.opencli/sites/catsco/watch-state.json`
(override with `CATSCO_WATCH_STATE_FILE`). Resident polling needs the browser
lease; stop it with Ctrl-C.

```bash
# notify me whenever agent 574 replies
opencli catsco watch p2p_275_574 --command 'osascript -e "display notification \"$CATSCO_MESSAGE\""'

# record timestamps of agent messages to a log file
opencli catsco watch p2p_275_574 --log ~/catsco-agent.log --command 'say "$CATSCO_MESSAGE"'

# single-shot check for a topic
opencli catsco watch grp_1258 --once
```

**Time recording.** Every detected message carries two timestamps: `created_at`
(the message's own time) and `fired_at` (when the watcher caught it). They appear
in the `--log` file as `[fired_at] ... msg_time=<created_at>`, in the webhook JSON
as `fired_at`/`created_at`, and in the command env as `CATSCO_FIRED_AT`/
`CATSCO_CREATED_AT`. Example log line:

```
[2026-08-04T03:01:18.831Z] topic=p2p_275_574 seq=518694 from=usr574 msg_time=2026-08-04T03:01:17.198363Z: 已收到：...
```

## Development

```bash
pnpm install
pnpm typecheck      # tsc --noEmit
pnpm test:run       # vitest
pnpm build:plugin   # esbuild .ts -> .js (run before opencli picks up changes)
```

The built `.js` files are gitignored; OpenCLI transpiles the `.ts` sources
automatically at load time, so committing the TypeScript is sufficient for
distribution.

## Loop control (P0): idempotent send, receipts, seq cursors

These three capabilities let a Controller (e.g. `loopctl`) safely drive an
existing topic's loop: retry without duplicates, reconcile after network
timeouts, and pull new events on a stable seq cursor.

### 1. Idempotent send — `send --client-message-id`

```bash
opencli catsco send <topic> --client-message-id "loop:42:action:review-001" --content-file packet.json -f json
```

The CatsCo backend dedupes on `(topic_id, sender_uid, client_msg_id)` and returns
a stable receipt. Re-sending the same `client_msg_id` returns the original
`seqId` with `duplicate: true`:

```json
{ "messageId": "524863", "topicId": "p2p_275_574", "clientMsgId": "loop:42",
  "seqId": "524863", "duplicate": false, "contentDigest": "sha256:…" }
```

> **Backend gap:** the same `client_msg_id` with *different* content currently
> returns `duplicate: true` (not a `409 client_message_id_conflict`). That
> conflict semantics needs a cats-company backend change.

### 2. Reconcile — `message-receipt`

```bash
opencli catsco message-receipt <topic> --client-message-id "loop:42:action:review-001" -f json
```

`{ "found": true, …, "serverConfirmed": true }` — used to check whether a send
landed after a network timeout. Receipts are recorded locally (per this CLI) at
`~/.opencli/sites/catsco/receipts.json` (`CATSCO_RECEIPT_FILE` to override).

> **Backend gap:** there is no server-side "lookup by client_msg_id" endpoint and
> the message-history response does not expose `client_msg_id`. The local
> registry covers sends made by this CLI; a server-authoritative lookup needs a
> small cats-company change to surface `client_msg_id`.

### 3. Pull by stable cursor — `messages --after-seq`

```bash
opencli catsco messages <topic> --after-seq 789 --limit 100 -f json
```

Returns ascending items strictly newer than the cursor plus the next cursor:

```json
{ "items": [ { "seqId": "790", "senderUid": "574", "kind": "text",
    "content": "…", "contentDigest": "sha256:…", "serverReceivedAt": "…" } ],
  "nextCursor": "790", "hasMore": false }
```

`seqId` is monotonic per topic; the Controller advances the cursor only after a
successful commit. This is seq-based, not offset-based.

> **Notes / backend gaps:** the backend has no `after_seq` param, so this fetches
> `latest=N` and filters client-side (correct for bounded topics; a large gap
> needs a bigger `--limit`). `run_id`/`body_id` are not exposed on ordinary
> messages (`run_id` only appears in `task_status`), and `contentDigest` is
> computed client-side (sha256 of the retrieved content) — the backend does not
> compute it. Because Go re-orders JSON keys, the digest of a structured packet
> may differ between the sent bytes and the retrieved content.
