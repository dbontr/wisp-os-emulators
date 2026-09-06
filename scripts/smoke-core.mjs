import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const wasmPath = resolve(process.argv[2] ?? '')
const profile = process.argv[3] ?? ''

if (!wasmPath || !['gba', 'genesis', 'snes'].includes(profile)) {
  throw new Error('usage: node scripts/smoke-core.mjs <core.wasm> <gba|genesis|snes>')
}

function writeAscii(bytes, offset, text, length = text.length) {
  for (let i = 0; i < length; i += 1) {
    bytes[offset + i] = i < text.length ? text.charCodeAt(i) & 0xff : 0x20
  }
}

function makeGenesisRom() {
  const rom = new Uint8Array(512 * 1024)
  rom.fill(0xff)
  const view = new DataView(rom.buffer)
  view.setUint32(0x0000, 0x00ff0000, false)
  view.setUint32(0x0004, 0x00000200, false)
  rom[0x0200] = 0x60 // BRA.S
  rom[0x0201] = 0xfe // branch to itself
  writeAscii(rom, 0x0100, 'SEGA GENESIS    ', 16)
  writeAscii(rom, 0x0120, 'WISP SMOKE TEST', 48)
  writeAscii(rom, 0x0150, 'WISP SMOKE TEST', 48)
  writeAscii(rom, 0x0180, 'GM 00000000-00', 14)
  writeAscii(rom, 0x01f0, 'U', 1)
  return rom
}

function makeSnesRom() {
  const rom = new Uint8Array(32 * 1024)
  rom.fill(0xea) // 65C816 NOP
  rom[0x0000] = 0x80 // BRA
  rom[0x0001] = 0xfe // branch to itself at $00:8000

  const header = 0x7fc0
  writeAscii(rom, header, 'WISP SMOKE TEST', 21)
  rom[header + 0x15] = 0x20 // LoROM, slow ROM
  rom[header + 0x16] = 0x00 // ROM only
  rom[header + 0x17] = 0x05 // 32 KiB
  rom[header + 0x18] = 0x00 // no SRAM
  rom[header + 0x19] = 0x01 // NTSC
  rom[header + 0x1a] = 0x33 // extended maker marker
  rom[header + 0x1b] = 0x00 // version
  rom[header + 0x1c] = 0xff // checksum complement
  rom[header + 0x1d] = 0xff
  rom[header + 0x1e] = 0x00 // checksum
  rom[header + 0x1f] = 0x00

  // Native + emulation reset/NMI/IRQ vectors point at $8000.
  for (const offset of [0x7fea, 0x7fec, 0x7fee, 0x7ffa, 0x7ffc, 0x7ffe]) {
    rom[offset] = 0x00
    rom[offset + 1] = 0x80
  }
  return rom
}

function makeGbaRom() {
  const rom = new Uint8Array(256 * 1024)
  // ARM B . at 0x08000000. This also satisfies mGBA's first ROM magic byte at offset 3.
  rom[0x0000] = 0xfe
  rom[0x0001] = 0xff
  rom[0x0002] = 0xff
  rom[0x0003] = 0xea
  writeAscii(rom, 0x00a0, 'WISPSMOKE', 12)
  writeAscii(rom, 0x00ac, 'WSMK', 4)
  writeAscii(rom, 0x00b0, '01', 2)
  rom[0x00b2] = 0x96 // mGBA's second GBA ROM magic byte
  return rom
}

const romBuilders = {
  gba: makeGbaRom,
  genesis: makeGenesisRom,
  snes: makeSnesRom,
}

const wasmBytes = readFileSync(wasmPath)
const module = new WebAssembly.Module(wasmBytes)
const moduleImports = WebAssembly.Module.imports(module)
let instanceExports = null
let frameCount = 0
let audioBatchCount = 0
let monotonicUs = 1_000_000n
let deterministicByte = 0x5a

function memory() {
  const value = instanceExports?.memory
  if (!(value instanceof WebAssembly.Memory)) throw new Error('core memory is not available')
  return value
}

function checkedRange(ptr, bytes, label) {
  if (!Number.isInteger(ptr) || !Number.isInteger(bytes) || ptr < 0 || bytes < 0) {
    throw new Error(`${label}: invalid memory range`)
  }
  const end = ptr + bytes
  if (!Number.isSafeInteger(end) || end > memory().buffer.byteLength) {
    throw new Error(`${label}: out-of-bounds memory range ${ptr}+${bytes}`)
  }
}

function setU32(ptr, value) {
  checkedRange(ptr, 4, 'wasi u32 write')
  new DataView(memory().buffer).setUint32(ptr, value >>> 0, true)
}

function setU64(ptr, value) {
  checkedRange(ptr, 8, 'wasi u64 write')
  new DataView(memory().buffer).setBigUint64(ptr, BigInt(value), true)
}

function wasiFunction(name) {
  switch (name) {
    case 'random_get':
      return (ptr, length) => {
        checkedRange(ptr, length, 'wasi random_get')
        const out = new Uint8Array(memory().buffer, ptr, length)
        for (let i = 0; i < out.length; i += 1) {
          deterministicByte = (deterministicByte * 33 + 17) & 0xff
          out[i] = deterministicByte
        }
        return 0
      }
    case 'clock_time_get':
      return (_clockId, _precision, outPtr) => {
        monotonicUs += 1000n
        setU64(outPtr, monotonicUs * 1000n)
        return 0
      }
    case 'fd_write':
      return (_fd, _iovs, _iovsLen, writtenPtr) => {
        setU32(writtenPtr, 0)
        return 0
      }
    case 'fd_seek':
      return (_fd, _offset, _whence, newOffsetPtr) => {
        setU64(newOffsetPtr, 0n)
        return 0
      }
    case 'environ_sizes_get':
    case 'args_sizes_get':
      return (countPtr, bytesPtr) => {
        setU32(countPtr, 0)
        setU32(bytesPtr, 0)
        return 0
      }
    case 'environ_get':
    case 'args_get':
    case 'fd_close':
      return () => 0
    case 'proc_exit':
      return (code) => {
        throw new Error(`core called wasi proc_exit(${code})`)
      }
    default:
      throw new Error(`unsupported WASI import ${name}`)
  }
}

const imports = {}
for (const item of moduleImports) {
  if (item.kind !== 'function') throw new Error(`unexpected imported ${item.kind}: ${item.module}.${item.name}`)
  imports[item.module] ??= {}

  if (item.module === 'wisp') {
    if (item.name === 'video_refresh') {
      imports.wisp.video_refresh = (ptr, width, height, pitchBytes) => {
        if (width <= 0 || height <= 0 || width > 8192 || height > 8192) {
          throw new Error(`invalid video dimensions ${width}x${height}`)
        }
        if (pitchBytes < width * 4 || pitchBytes > width * 16) {
          throw new Error(`invalid video pitch ${pitchBytes} for width ${width}`)
        }
        checkedRange(ptr, pitchBytes * height, 'video frame')
        frameCount += 1
      }
    } else if (item.name === 'audio_batch') {
      imports.wisp.audio_batch = (ptr, frames, sampleRate, channels) => {
        if (frames < 0 || frames > 1_000_000) throw new Error(`invalid audio frame count ${frames}`)
        if (sampleRate <= 0 || sampleRate > 768_000) throw new Error(`invalid audio rate ${sampleRate}`)
        if (channels <= 0 || channels > 8) throw new Error(`invalid audio channel count ${channels}`)
        checkedRange(ptr, frames * channels * 2, 'audio batch')
        audioBatchCount += 1
      }
    } else if (item.name === 'input_state') {
      imports.wisp.input_state = () => 0
    } else if (item.name === 'monotonic_time_us') {
      imports.wisp.monotonic_time_us = () => {
        monotonicUs += 16_667n
        return monotonicUs
      }
    } else {
      throw new Error(`unknown Wisp import ${item.name}`)
    }
  } else if (item.module === 'wasi_snapshot_preview1') {
    imports.wasi_snapshot_preview1[item.name] = wasiFunction(item.name)
  } else {
    throw new Error(`unauthorized import module ${item.module}.${item.name}`)
  }
}

const instance = new WebAssembly.Instance(module, imports)
instanceExports = instance.exports
const requiredFunctions = [
  'wisp_core_api_version',
  'wisp_core_init',
  'wisp_core_load_game',
  'wisp_core_run',
  'wisp_core_reset',
  'wisp_core_unload',
  'wisp_core_deinit',
  'wisp_core_alloc',
  'wisp_core_free',
]
for (const name of requiredFunctions) {
  if (typeof instanceExports[name] !== 'function') throw new Error(`missing core function ${name}`)
}
if (!(instanceExports.memory instanceof WebAssembly.Memory)) throw new Error('missing exported core memory')
if (typeof instanceExports._initialize === 'function') instanceExports._initialize()
if (instanceExports.wisp_core_api_version() !== 1) throw new Error('core ABI version is not 1')
if (instanceExports.wisp_core_init() !== 1) throw new Error('core init failed')

const rom = romBuilders[profile]()
const romPtr = instanceExports.wisp_core_alloc(rom.byteLength)
if (!romPtr) throw new Error(`core failed to allocate ${rom.byteLength} ROM bytes`)
checkedRange(romPtr, rom.byteLength, 'ROM copy')
new Uint8Array(memory().buffer, romPtr, rom.byteLength).set(rom)
const loaded = instanceExports.wisp_core_load_game(romPtr, rom.byteLength)
instanceExports.wisp_core_free(romPtr)
if (loaded !== 1) throw new Error(`${profile} synthetic ROM was rejected`)

instanceExports.wisp_core_run()
if (frameCount < 1) throw new Error(`${profile} produced no video frame`)
const firstFrameCount = frameCount
instanceExports.wisp_core_run()
if (frameCount <= firstFrameCount) throw new Error(`${profile} did not produce a second video frame`)

instanceExports.wisp_core_reset()
const beforeResetFrame = frameCount
instanceExports.wisp_core_run()
if (frameCount <= beforeResetFrame) throw new Error(`${profile} produced no frame after reset`)

if (
  typeof instanceExports.wisp_core_state_size === 'function' &&
  typeof instanceExports.wisp_core_serialize === 'function' &&
  typeof instanceExports.wisp_core_unserialize === 'function'
) {
  const stateBytes = instanceExports.wisp_core_state_size()
  if (stateBytes > 0 && stateBytes <= 32 * 1024 * 1024) {
    const statePtr = instanceExports.wisp_core_alloc(stateBytes)
    if (!statePtr) throw new Error(`failed to allocate ${stateBytes} state bytes`)
    const serialized = instanceExports.wisp_core_serialize(statePtr, stateBytes)
    if (serialized !== stateBytes) throw new Error(`state serialize returned ${serialized}, expected ${stateBytes}`)
    if (instanceExports.wisp_core_unserialize(statePtr, stateBytes) !== 1) throw new Error('state unserialize failed')
    instanceExports.wisp_core_free(statePtr)
  }
}

instanceExports.wisp_core_unload()
instanceExports.wisp_core_deinit()
console.log(
  `Smoke-tested ${profile}: ${rom.byteLength} synthetic ROM bytes, ${frameCount} video frames, ${audioBatchCount} audio batches, ${moduleImports.length} imports`,
)
