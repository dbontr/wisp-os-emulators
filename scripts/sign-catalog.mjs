import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const source = JSON.parse(readFileSync(resolve(root, 'catalog.source.json'), 'utf8'))
const keyPath = process.env.OS_SIGNING_KEY_PATH ?? join(homedir(), '.wispos', 'image-signing-private.pem')
const privateKey = createPrivateKey(readFileSync(keyPath))
const publicDer = createPublicKey(privateKey).export({ type: 'spki', format: 'der' })
const keyId = createHash('sha256').update(publicDer).digest('hex').slice(0, 16)
if (keyId !== '897b000f312c6acc') throw new Error(`Signing key ${keyId} does not match the WispOS trust root`)

const signature = sign('sha256', Buffer.from(canonicalJson(source)), {
  key: privateKey,
  dsaEncoding: 'ieee-p1363',
}).toString('base64')
const catalog = {
  ...source,
  signature: { keyId, algorithm: 'ECDSA-P256-SHA256', value: signature },
}
writeFileSync(resolve(root, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`)
console.log(`Signed ${source.cores.length} emulator cores with ${keyId}`)

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
}
