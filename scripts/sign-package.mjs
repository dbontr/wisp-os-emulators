import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'

const sourcePath = resolve(process.argv[2] ?? '')
const artifactRoot = resolve(process.argv[3] ?? '')
if (!sourcePath || !artifactRoot) {
  throw new Error('usage: node scripts/sign-package.mjs <package.source.json> <artifact-directory>')
}

const source = JSON.parse(readFileSync(sourcePath, 'utf8'))
validateSource(source)
const artifacts = source.artifactPaths.map((path) => {
  const bytes = readFileSync(resolve(artifactRoot, path))
  return {
    path,
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
})
const unsigned = {
  format: 1,
  id: source.id,
  name: source.name,
  version: source.version,
  kind: 'emulator',
  entrypoint: source.entrypoint,
  artifacts,
  permissions: [],
  metadata: source.metadata,
}

const keyPath = process.env.OS_SIGNING_KEY_PATH ?? join(homedir(), '.wispos', 'image-signing-private.pem')
const privateKey = createPrivateKey(readFileSync(keyPath))
const publicDer = createPublicKey(privateKey).export({ type: 'spki', format: 'der' })
const keyId = createHash('sha256').update(publicDer).digest('hex').slice(0, 16)
if (keyId !== '897b000f312c6acc') throw new Error(`Signing key ${keyId} does not match the WispOS trust root`)
const signature = sign('sha256', Buffer.from(canonicalJson(unsigned)), {
  key: privateKey,
  dsaEncoding: 'ieee-p1363',
}).toString('base64')
const manifest = {
  ...unsigned,
  signature: { keyId, algorithm: 'ECDSA-P256-SHA256', value: signature },
}
writeFileSync(resolve(artifactRoot, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Signed ${source.id}@${source.version}: ${artifacts.reduce((sum, item) => sum + item.bytes, 0)} bytes`)

function validateSource(value) {
  if (!value || typeof value !== 'object' || !/^[a-z0-9][a-z0-9._-]*$/.test(value.id)
    || typeof value.name !== 'string' || !value.name.trim()
    || typeof value.version !== 'string' || !value.version.trim()
    || typeof value.entrypoint !== 'string' || !value.entrypoint.endsWith('.wasm')
    || !Array.isArray(value.artifactPaths) || !value.artifactPaths.length
    || !value.artifactPaths.includes(value.entrypoint)) throw new Error('invalid emulator package source')
  const paths = new Set()
  for (const path of value.artifactPaths) {
    if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('\\')
      || path.split('/').some((part) => !part || part === '.' || part === '..') || paths.has(path)) {
      throw new Error(`unsafe or duplicated artifact path: ${path}`)
    }
    paths.add(path)
  }
  if (!value.metadata || value.metadata.type !== 'emulator-core' || value.metadata.coreAbi !== 1
    || !Array.isArray(value.metadata.systems) || !value.metadata.systems.length) {
    throw new Error('invalid emulator core metadata')
  }
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
}
