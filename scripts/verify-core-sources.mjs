import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const mgbaRevision = 'c034660f007c543233f1cadeb0ca13c71afd8f41'
const jgenesisRevision = '0b26611fa23007f2632d32b7cdbdb6369b01eb91'
const geckoRevision = 'da39be17b22eb7316e772d2369da15df3a52f7f0'

const required = [
  'CORE_ABI.md',
  'CORE_TARGETS.md',
  'STREAMED_CORE_DESIGN.md',
  'MODERN_CORE_PROBES.md',
  'cores/mgba/wisp_core.c',
  'cores/mgba/build.sh',
  'cores/jgenesis-common/prepare.sh',
  'cores/jgenesis-genesis/build.sh',
  'cores/jgenesis-genesis/src/lib.rs',
  'cores/jgenesis-snes/build.sh',
  'cores/jgenesis-snes/src/lib.rs',
  'probes/gecko-web/build.sh',
  'packages/mgba/package.source.json',
  'packages/jgenesis-genesis/package.source.json',
  'packages/jgenesis-snes/package.source.json',
  'scripts/check-core-wasm.mjs',
  'scripts/sign-package.mjs',
  'REFERENCES.md',
]
for (const path of required) {
  if (!existsSync(resolve(root, path))) throw new Error(`missing emulator source artifact: ${path}`)
}

assertPinnedBuild('cores/mgba/build.sh', 'MGBA_REF', mgbaRevision, 'mGBA.license')
assertPinnedBuild('cores/jgenesis-genesis/build.sh', 'JGENESIS_REF', jgenesisRevision, 'jgenesis.license')
assertPinnedBuild('cores/jgenesis-snes/build.sh', 'JGENESIS_REF', jgenesisRevision, 'jgenesis.license')
assertPinnedSource('probes/gecko-web/build.sh', 'GECKO_REF', geckoRevision)

for (const path of [
  'cores/mgba/wisp_core.c',
  'cores/jgenesis-genesis/src/lib.rs',
  'cores/jgenesis-snes/src/lib.rs',
]) {
  const adapter = readFileSync(resolve(root, path), 'utf8')
  for (const symbol of [
    'wisp_core_api_version', 'wisp_core_init', 'wisp_core_load_game', 'wisp_core_run',
    'wisp_core_reset', 'wisp_core_unload', 'wisp_core_deinit', 'wisp_core_alloc', 'wisp_core_free',
  ]) {
    if (!adapter.includes(`${symbol}(`)) throw new Error(`${path} is missing ${symbol}`)
  }
  for (const prohibited of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'Microsoft Graph']) {
    if (adapter.includes(prohibited)) throw new Error(`${path} contains prohibited host authority: ${prohibited}`)
  }
}

assertPackage({
  path: 'packages/mgba/package.source.json',
  id: 'mgba', systems: ['gb', 'gbc', 'gba'], licenseArtifact: 'mGBA.license',
  repository: 'https://github.com/mgba-emu/mgba', revision: mgbaRevision, license: 'MPL-2.0',
})
assertPackage({
  path: 'packages/jgenesis-genesis/package.source.json',
  id: 'jgenesis-genesis', systems: ['genesis'], licenseArtifact: 'jgenesis.license',
  repository: 'https://github.com/jsgroth/jgenesis', revision: jgenesisRevision, license: 'GPL-3.0',
})
assertPackage({
  path: 'packages/jgenesis-snes/package.source.json',
  id: 'jgenesis-snes', systems: ['snes'], licenseArtifact: 'jgenesis.license',
  repository: 'https://github.com/jsgroth/jgenesis', revision: jgenesisRevision, license: 'GPL-3.0',
})

const modernProbes = readFileSync(resolve(root, 'MODERN_CORE_PROBES.md'), 'utf8')
if (!modernProbes.includes(geckoRevision)) throw new Error('Gecko probe documentation must name the pinned revision')

const references = readFileSync(resolve(root, 'REFERENCES.md'), 'utf8')
for (const source of [
  'mgba-emu/mgba', 'jsgroth/jgenesis', 'ioncodes/gecko', 'dolphin-emu/dolphin',
  'cemu-project/Cemu', 'xenia-project/xenia', 'voland-emu/Voland',
]) {
  if (!references.includes(source)) throw new Error(`REFERENCES.md is missing ${source}`)
}

console.log('Verified emulator source policy and pinned core targets')

function assertPinnedSource(path, variable, revision) {
  const source = readFileSync(resolve(root, path), 'utf8')
  const expected = `${variable}="\${${variable}:-${revision}}"`
  if (!source.includes(expected)) throw new Error(`${path} must default to reviewed revision ${revision}`)
  if (/archive\/(?:tip|master|main)|checkout\s+(?:master|main)\b/.test(source)) {
    throw new Error(`${path} cannot default to a moving upstream revision`)
  }
}

function assertPinnedBuild(path, variable, revision, licenseArtifact) {
  assertPinnedSource(path, variable, revision)
  const build = readFileSync(resolve(root, path), 'utf8')
  if (!build.includes(licenseArtifact)) throw new Error(`${path} must preserve ${licenseArtifact}`)
}

function assertPackage({ path, id, systems, licenseArtifact, repository, revision, license }) {
  const source = JSON.parse(readFileSync(resolve(root, path), 'utf8'))
  if (source.id !== id || source.entrypoint !== 'core.wasm'
    || source.metadata?.type !== 'emulator-core' || source.metadata?.coreAbi !== 1) {
    throw new Error(`${path} does not match Wisp core ABI 1`)
  }
  const declaredSystems = source.metadata.systems.map((system) => system.id).sort().join(',')
  if (declaredSystems !== [...systems].sort().join(',')) throw new Error(`${path} has the wrong system table`)
  if (!source.artifactPaths.includes(licenseArtifact)) throw new Error(`${path} must include ${licenseArtifact}`)
  const upstream = source.metadata.source
  if (upstream?.repository !== repository || upstream?.revision !== revision || upstream?.license !== license
    || upstream?.correspondingSource !== `${repository}/tree/${revision}`) {
    throw new Error(`${path} must declare immutable upstream source and license metadata`)
  }
}
