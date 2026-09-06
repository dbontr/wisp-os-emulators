import { createPublicKey, verify } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const catalog = JSON.parse(readFileSync(resolve(root, 'catalog.json'), 'utf8'))
const { signature, ...unsigned } = catalog
if (catalog.format !== 1 || typeof catalog.name !== 'string' || !catalog.name.trim()
  || typeof catalog.updatedAt !== 'string' || Number.isNaN(Date.parse(catalog.updatedAt))
  || !Array.isArray(catalog.cores) || catalog.cores.length > 256) {
  throw new Error('Emulator catalog shape is invalid')
}
if (signature?.keyId !== '897b000f312c6acc' || signature?.algorithm !== 'ECDSA-P256-SHA256'
  || typeof signature.value !== 'string' || !signature.value) {
  throw new Error('Emulator catalog signer is not the WispOS trust root')
}
const publicKey = createPublicKey({
  key: Buffer.from('MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEzlFte6HoFNzm6vt8NFYU86cST5kJ+FIFZMF79BNYJ4CLiuttCK52L2lLln7qI4SLiFQJ4HLc2bb335d8Yeiq0g==', 'base64'),
  format: 'der',
  type: 'spki',
})
const valid = verify('sha256', Buffer.from(canonicalJson(unsigned)), {
  key: publicKey,
  dsaEncoding: 'ieee-p1363',
}, Buffer.from(signature.value, 'base64'))
if (!valid) throw new Error('Emulator catalog signature verification failed')

const coreIds = new Set()
const systemIds = new Set()
const extensions = new Set()
for (const core of catalog.cores) {
  if (!core || typeof core !== 'object' || typeof core.id !== 'string'
    || !/^[a-z0-9][a-z0-9._-]*$/.test(core.id) || coreIds.has(core.id)
    || typeof core.name !== 'string' || !core.name.trim() || core.name.length > 160
    || typeof core.version !== 'string' || !core.version.trim() || core.version.length > 80
    || typeof core.description !== 'string' || !core.description.trim() || core.description.length > 2_000
    || !Array.isArray(core.systems) || core.systems.length < 1 || core.systems.length > 16
    || typeof core.packageUrl !== 'string') {
    throw new Error('Emulator catalog core is invalid')
  }
  assertImmutablePackageUrl(core)
  coreIds.add(core.id)

  for (const system of core.systems) {
    if (!system || typeof system !== 'object' || typeof system.id !== 'string'
      || !/^[a-z0-9][a-z0-9._-]*$/.test(system.id) || systemIds.has(system.id)
      || typeof system.name !== 'string' || !system.name.trim() || system.name.length > 120
      || !Array.isArray(system.extensions) || system.extensions.length < 1 || system.extensions.length > 16) {
      throw new Error(`Emulator system metadata is invalid: ${core.id}`)
    }
    systemIds.add(system.id)
    const localExtensions = new Set()
    for (const extension of system.extensions) {
      if (typeof extension !== 'string' || !/^[a-z0-9]+$/.test(extension)
        || localExtensions.has(extension) || extensions.has(extension)) {
        throw new Error(`Emulator file extension is ambiguous: ${String(extension)}`)
      }
      localExtensions.add(extension)
      extensions.add(extension)
    }
  }
}
console.log(`Verified signed emulator catalog with ${catalog.cores.length} deterministic cores`)

function assertImmutablePackageUrl(core) {
  const url = new URL(core.packageUrl)
  const expected = new RegExp(`^/dbontr/wisp-os-emulators/[0-9a-f]{40}/packages/${escapeRegex(core.id)}/${escapeRegex(core.version)}/package\\.json$`)
  if (url.protocol !== 'https:' || url.hostname !== 'raw.githubusercontent.com'
    || url.username || url.password || url.search || url.hash || !expected.test(url.pathname)) {
    throw new Error(`Emulator core ${core.id} must use immutable raw GitHub package transport`)
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
}