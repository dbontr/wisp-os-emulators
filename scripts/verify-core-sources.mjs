import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const mgbaRevision = 'c034660f007c543233f1cadeb0ca13c71afd8f41'
const jgenesisRevision = '0b26611fa23007f2632d32b7cdbdb6369b01eb91'
const rustToolchain = '1.98.1'
const nodeVersion = '24.20.0'
const checkoutAction = 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262'
const setupNodeAction = 'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020'
const uploadArtifactAction = 'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02'
const emsdkImage = 'emscripten/emsdk@sha256:f8a157011b8fa61bdaab875bb1f0f08695229dffe086448d14b53538cae16bd3'

const required = [
  'CORE_ABI.md',
  'CORE_TARGETS.md',
  'CORE_FAMILIES.md',
  'CATALOG.md',
  'cores/mgba/wisp_core.c',
  'cores/mgba/build.sh',
  'cores/jgenesis-common/prepare.sh',
  'cores/jgenesis-genesis/build.sh',
  'cores/jgenesis-genesis/Cargo.toml',
  'cores/jgenesis-genesis/src/lib.rs',
  'cores/jgenesis-snes/build.sh',
  'cores/jgenesis-snes/Cargo.toml',
  'cores/jgenesis-snes/src/lib.rs',
  'packages/mgba/package.source.json',
  'packages/jgenesis-genesis/package.source.json',
  'packages/jgenesis-snes/package.source.json',
  'scripts/check-core-wasm.mjs',
  'scripts/sign-package.mjs',
  '.github/workflows/build-cores.yml',
  '.github/workflows/verify.yml',
  'REFERENCES.md',
]
for (const path of required) {
  if (!existsSync(resolve(root, path))) throw new Error(`Missing emulator source artifact: ${path}`)
}

assertPinnedBuild('cores/mgba/build.sh', 'MGBA_REF', mgbaRevision, 'mGBA.license')
assertPinnedBuild('cores/jgenesis-genesis/build.sh', 'JGENESIS_REF', jgenesisRevision, 'jgenesis.license')
assertPinnedBuild('cores/jgenesis-snes/build.sh', 'JGENESIS_REF', jgenesisRevision, 'jgenesis.license')
assertRustToolchain('cores/jgenesis-genesis/build.sh')
assertRustToolchain('cores/jgenesis-snes/build.sh')
assertWrapperDependencies('cores/jgenesis-genesis/Cargo.toml')
assertWrapperDependencies('cores/jgenesis-snes/Cargo.toml')
assertMgbaMemoryPolicy('cores/mgba/build.sh')
assertWorkflowPins('.github/workflows/build-cores.yml', true)
assertWorkflowPins('.github/workflows/verify.yml', false)

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

const references = readFileSync(resolve(root, 'REFERENCES.md'), 'utf8')
for (const source of ['mgba-emu/mgba', 'jsgroth/jgenesis', 'WebAssembly/WASI']) {
  if (!references.includes(source)) throw new Error(`REFERENCES.md is missing ${source}`)
}

console.log('Verified pinned emulator source, build environment, and package policy')

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

function assertRustToolchain(path) {
  const build = readFileSync(resolve(root, path), 'utf8')
  const required = [
    `RUST_TOOLCHAIN="\${RUST_TOOLCHAIN:-${rustToolchain}}"`,
    'rustup toolchain install "${RUST_TOOLCHAIN}" --profile minimal',
    'rustup target add --toolchain "${RUST_TOOLCHAIN}" wasm32-unknown-unknown',
    'rustup run "${RUST_TOOLCHAIN}" cargo build',
  ]
  for (const value of required) {
    if (!build.includes(value)) throw new Error(`${path} must pin Rust ${rustToolchain} through rustup`)
  }
}

function assertWrapperDependencies(path) {
  const manifest = readFileSync(resolve(root, path), 'utf8')
  for (const dependency of ['bincode = "=2.0.1"', 'getrandom = "=0.4.3"']) {
    if (!manifest.includes(dependency)) throw new Error(`${path} must pin reviewed wrapper dependency ${dependency}`)
  }
}

function assertMgbaMemoryPolicy(path) {
  const build = readFileSync(resolve(root, path), 'utf8')
  for (const value of [
    '-sINITIAL_MEMORY=67108864',
    '-sALLOW_MEMORY_GROWTH=0',
  ]) {
    if (!build.includes(value)) throw new Error(`${path} is missing fixed mGBA memory policy: ${value}`)
  }
  for (const prohibited of ['-sINITIAL_MEMORY=134217728', '-sALLOW_MEMORY_GROWTH=1', '-sMAXIMUM_MEMORY=']) {
    if (build.includes(prohibited)) throw new Error(`${path} contains disallowed mGBA memory configuration: ${prohibited}`)
  }
}

function assertWorkflowPins(path, requiresArtifacts) {
  const workflow = readFileSync(resolve(root, path), 'utf8')
  for (const value of ['runs-on: ubuntu-24.04', checkoutAction, setupNodeAction, `node-version: '${nodeVersion}'`]) {
    if (!workflow.includes(value)) throw new Error(`${path} is missing build-environment pin: ${value}`)
  }
  if (requiresArtifacts) {
    if (!workflow.includes(uploadArtifactAction)) throw new Error(`${path} must pin the upload-artifact action`)
    if (!workflow.includes(emsdkImage)) throw new Error(`${path} must pin the Emscripten image digest`)
  }
  if (/actions\/(?:checkout|setup-node|upload-artifact)@v\d+/.test(workflow)) {
    throw new Error(`${path} contains a moving GitHub Action major-version ref`)
  }
  if (workflow.includes('ubuntu-latest')) throw new Error(`${path} contains a moving runner label`)
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
    || upstream?.correspondingSource !== `${repository}/tree/${revision}`
    || !/^[0-9a-f]{40}$/.test(upstream.revision)) {
    throw new Error(`${path} must declare immutable upstream source and license metadata`)
  }
}
