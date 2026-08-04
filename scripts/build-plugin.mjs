import { rmSync } from 'node:fs'
import { build } from 'esbuild'

const commandEntries = [
  ['catsco-me.ts', 'catsco-me.js'],
  ['catsco-agents.ts', 'catsco-agents.js'],
  ['catsco-conversations.ts', 'catsco-conversations.js'],
  ['catsco-projects.ts', 'catsco-projects.js'],
  ['catsco-project-sessions.ts', 'catsco-project-sessions.js'],
  ['catsco-messages.ts', 'catsco-messages.js'],
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
