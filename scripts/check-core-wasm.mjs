import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const file = resolve(process.argv[2] ?? '')
const maxBytes = Number(process.argv[3] ?? 2 * 1024 * 1024)
if (!file || !Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
  throw new Error('usage: node scripts/check-core-wasm.mjs <core.wasm> [max-bytes]')
}

const bytes = readFileSync(file)
if (bytes.byteLength > maxBytes) {
  throw new Error(`core is ${bytes.byteLength} bytes; limit is ${maxBytes}`)
}
const module = new WebAssembly.Module(bytes)
const exports = new Map(WebAssembly.Module.exports(module).map((item) => [item.name, item.kind]))
const required = [
  ['memory', 'memory'],
  ['wisp_core_api_version', 'function'],
  ['wisp_core_init', 'function'],
  ['wisp_core_load_game', 'function'],
  ['wisp_core_run', 'function'],
  ['wisp_core_reset', 'function'],
  ['wisp_core_unload', 'function'],
  ['wisp_core_deinit', 'function'],
  ['wisp_core_alloc', 'function'],
  ['wisp_core_free', 'function'],
]
for (const [name, kind] of required) {
  if (exports.get(name) !== kind) throw new Error(`missing ${kind} export: ${name}`)
}

const allowedWisp = new Set(['video_refresh', 'audio_batch', 'input_state', 'monotonic_time_us'])
const allowedModules = new Set(['wisp', 'wasi_snapshot_preview1'])
for (const item of WebAssembly.Module.imports(module)) {
  if (!allowedModules.has(item.module)) {
    throw new Error(`core imports unauthorized module ${item.module}.${item.name}`)
  }
  if (item.module === 'wisp' && !allowedWisp.has(item.name)) {
    throw new Error(`core imports unknown Wisp host function ${item.name}`)
  }
  if (item.kind === 'memory' || item.kind === 'table' || item.kind === 'global') {
    throw new Error(`core may not import host ${item.kind}: ${item.module}.${item.name}`)
  }
}

console.log(`Verified Wisp core ${file}: ${bytes.byteLength} bytes, ${WebAssembly.Module.imports(module).length} imports`)
