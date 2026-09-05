import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const required = [
  'CORE_ABI.md',
  'CORE_TARGETS.md',
  'STREAMED_CORE_DESIGN.md',
  'cores/mgba/wisp_core.c',
  'cores/mgba/build.sh',
  'packages/mgba/package.source.json',
  'scripts/check-core-wasm.mjs',
  'scripts/sign-package.mjs',
  'REFERENCES.md',
]
for (const path of required) {
  if (!existsSync(resolve(root, path))) throw new Error(`missing emulator source artifact: ${path}`)
}

const build = readFileSync(resolve(root, 'cores/mgba/build.sh'), 'utf8')
const expectedRef = 'c034660f007c543233f1cadeb0ca13c71afd8f41'
if (!build.includes(`MGBA_REF="${'${MGBA_REF:-'}${expectedRef}}"`)) {
  throw new Error('mGBA build must default to the reviewed immutable revision')
}
if (/archive\/(?:tip|master|main)|checkout\s+(?:master|main)\b/.test(build)) {
  throw new Error('core build cannot default to a moving upstream revision')
}
if (!build.includes('mGBA.license')) throw new Error('mGBA build must preserve the upstream license')

const core = readFileSync(resolve(root, 'cores/mgba/wisp_core.c'), 'utf8')
for (const symbol of [
  'wisp_core_api_version', 'wisp_core_init', 'wisp_core_load_game', 'wisp_core_run',
  'wisp_core_reset', 'wisp_core_unload', 'wisp_core_deinit', 'wisp_core_alloc', 'wisp_core_free',
]) {
  if (!core.includes(`${symbol}(`)) throw new Error(`mGBA adapter is missing ${symbol}`)
}
for (const prohibited of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'Microsoft Graph']) {
  if (core.includes(prohibited)) throw new Error(`emulator adapter contains prohibited host authority: ${prohibited}`)
}

const packageSource = JSON.parse(readFileSync(resolve(root, 'packages/mgba/package.source.json'), 'utf8'))
if (packageSource.id !== 'mgba' || packageSource.entrypoint !== 'core.wasm'
  || packageSource.metadata?.type !== 'emulator-core' || packageSource.metadata?.coreAbi !== 1) {
  throw new Error('mGBA package source does not match Wisp core ABI 1')
}
const systems = packageSource.metadata.systems.map((system) => system.id).sort().join(',')
if (systems !== 'gb,gbc,gba') throw new Error('mGBA package must declare GB, GBC, and GBA exactly')
if (!packageSource.artifactPaths.includes('mGBA.license')) throw new Error('mGBA package must include its license artifact')

const references = readFileSync(resolve(root, 'REFERENCES.md'), 'utf8')
for (const source of ['mgba-emu/mgba', 'dolphin-emu/dolphin', 'cemu-project/Cemu', 'xenia-project/xenia']) {
  if (!references.includes(source)) throw new Error(`REFERENCES.md is missing ${source}`)
}

console.log('Verified emulator source policy and pinned core targets')
