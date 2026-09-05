import { createPublicKey, verify } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const catalog = JSON.parse(readFileSync(resolve(root, 'catalog.json'), 'utf8'))
const { signature, ...unsigned } = catalog
if (catalog.format !== 1 || typeof catalog.name !== 'string' || !Array.isArray(catalog.cores)) {
  throw new Error('Emulator catalog shape is invalid')
}
if (signature?.keyId !== '897b000f312c6acc' || signature?.algorithm !== 'ECDSA-P256-SHA256') {
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

const ids = new Set()
for (const core of catalog.cores) {
  if (!core || typeof core !== 'object' || typeof core.id !== 'string'
    || !/^[a-z0-9][a-z0-9._-]*$/.test(core.id) || ids.has(core.id)
    || typeof core.name !== 'string' || typeof core.version !== 'string'
    || typeof core.description !== 'string' || !Array.isArray(core.systems) || !core.systems.length
    || typeof core.packageUrl !== 'string') throw new Error('Emulator catalog core is invalid')
  const url = new URL(core.packageUrl)
  if (url.protocol !== 'https:' || !['github.com', 'raw.githubusercontent.com', 'objects.githubusercontent.com',
    'github-releases.githubusercontent.com', 'release-assets.githubusercontent.com'].includes(url.hostname)) {
    throw new Error(`Emulator core ${core.id} uses an unapproved transport`)
  }
  ids.add(core.id)
}
console.log(`Verified signed emulator catalog with ${catalog.cores.length} cores`)

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
}
