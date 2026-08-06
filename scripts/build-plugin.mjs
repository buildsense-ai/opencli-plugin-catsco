import { rmSync } from 'node:fs'
import { build } from 'esbuild'

const commandEntries = [
  ['catsco-me.ts', 'catsco-me.js'],
  ['catsco-agents.ts', 'catsco-agents.js'],
  ['catsco-conversations.ts', 'catsco-conversations.js'],
  ['catsco-projects.ts', 'catsco-projects.js'],
  ['catsco-project-sessions.ts', 'catsco-project-sessions.js'],
  ['catsco-friends.ts', 'catsco-friends.js'],
  ['catsco-user-search.ts', 'catsco-user-search.js'],
  ['catsco-friend-request.ts', 'catsco-friend-request.js'],
  ['catsco-friend-accept.ts', 'catsco-friend-accept.js'],
  ['catsco-friend-reject.ts', 'catsco-friend-reject.js'],
  ['catsco-groups.ts', 'catsco-groups.js'],
  ['catsco-group-invite.ts', 'catsco-group-invite.js'],
  ['catsco-messages.ts', 'catsco-messages.js'],
  ['catsco-message-receipt.ts', 'catsco-message-receipt.js'],
  ['catsco-entries.ts', 'catsco-entries.js'],
  ['catsco-artifacts.ts', 'catsco-artifacts.js'],
  ['catsco-open.ts', 'catsco-open.js'],
  ['catsco-send.ts', 'catsco-send.js'],
  ['catsco-chat.ts', 'catsco-chat.js'],
  ['catsco-watch.ts', 'catsco-watch.js'],
  ['catsco-login.ts', 'catsco-login.js']
]

for (const [input, output] of commandEntries) {
  await build({
    bundle: true,
    entryPoints: [input],
    external: ['@jackwener/opencli/registry', '@jackwener/opencli/errors'],
    format: 'esm',
    outfile: output,
    packages: 'external',
    platform: 'node',
    target: 'node20'
  })
}

rmSync('pnpm-lock.yaml', { force: true })
