import { createHash, createPublicKey, verify } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const catalog = JSON.parse(readFileSync(resolve(root, 'catalog.json'), 'utf8'))
const publicKey = createPublicKey({
  key: Buffer.from('MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEzlFte6HoFNzm6vt8NFYU86cST5kJ+FIFZMF79BNYJ4CLiuttCK52L2lLln7qI4SLiFQJ4HLc2bb335d8Yeiq0g==', 'base64'),
  format: 'der',
  type: 'spki',
})
const maxPackageBytes = 2 * 1024 * 1024
const allowedArtifact = /(?:\.wasm|\.json|\.txt|\.md|\.license)$/i

for (const item of catalog.cores) verifyCatalogPackage(item)
console.log(`Verified ${catalog.cores.length} signed emulator packages and artifact tables`)

function verifyCatalogPackage(item) {
  const packageUrl = new URL(item.packageUrl)
  const expectedSuffix = `/packages/${item.id}/${item.version}/package.json`
  if (packageUrl.protocol !== 'https:' || packageUrl.hostname !== 'raw.githubusercontent.com'
    || !packageUrl.pathname.startsWith('/dbontr/wisp-os-emulators/') || !packageUrl.pathname.endsWith(expectedSuffix)) {
    throw new Error(`Emulator core ${item.id} must use immutable raw GitHub package transport`)
  }
  const revision = packageUrl.pathname.slice('/dbontr/wisp-os-emulators/'.length, -expectedSuffix.length)
  if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error(`Emulator core ${item.id} package URL must pin a commit SHA`)

  const packageRoot = resolve(root, 'packages', item.id, item.version)
  const manifestPath = resolve(packageRoot, 'package.json')
  if (!existsSync(manifestPath)) throw new Error(`Missing package manifest for ${item.id}@${item.version}`)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const sourcePath = resolve(root, 'packages', item.id, 'package.source.json')
  if (!existsSync(sourcePath)) throw new Error(`Missing package source descriptor for ${item.id}`)
  const source = JSON.parse(readFileSync(sourcePath, 'utf8'))

  if (manifest.format !== 1 || manifest.id !== item.id || manifest.name !== item.name
    || manifest.version !== item.version || manifest.kind !== 'emulator'
    || typeof manifest.entrypoint !== 'string' || !manifest.entrypoint.endsWith('.wasm')
    || !Array.isArray(manifest.artifacts) || !manifest.artifacts.length
    || !Array.isArray(manifest.permissions) || manifest.permissions.length !== 0) {
    throw new Error(`Package manifest does not match catalog entry: ${item.id}`)
  }
  if (source.id !== manifest.id || source.name !== manifest.name || source.version !== manifest.version
    || source.entrypoint !== manifest.entrypoint || canonicalJson(source.metadata) !== canonicalJson(manifest.metadata)) {
    throw new Error(`Package source descriptor does not match signed manifest: ${item.id}`)
  }
  if (canonicalJson(item.systems) !== canonicalJson(manifest.metadata?.systems)) {
    throw new Error(`Catalog system metadata does not match signed package: ${item.id}`)
  }

  const { signature, ...unsigned } = manifest
  if (signature?.keyId !== '897b000f312c6acc' || signature?.algorithm !== 'ECDSA-P256-SHA256'
    || typeof signature.value !== 'string' || !signature.value) {
    throw new Error(`Package signature metadata is invalid: ${item.id}`)
  }
  const valid = verify('sha256', Buffer.from(canonicalJson(unsigned)), {
    key: publicKey,
    dsaEncoding: 'ieee-p1363',
  }, Buffer.from(signature.value, 'base64'))
  if (!valid) throw new Error(`Package signature verification failed: ${item.id}`)

  const paths = new Set()
  let totalBytes = 0
  for (const artifact of manifest.artifacts) {
    if (!artifact || unsafePath(artifact.path) || paths.has(artifact.path) || !allowedArtifact.test(artifact.path)
      || !Number.isSafeInteger(artifact.bytes) || artifact.bytes < 0
      || !/^[0-9a-f]{64}$/.test(artifact.sha256)) {
      throw new Error(`Package artifact table is invalid: ${item.id}`)
    }
    const artifactPath = resolve(packageRoot, artifact.path)
    if (!existsSync(artifactPath)) throw new Error(`Missing package artifact: ${item.id}/${artifact.path}`)
    const bytes = readFileSync(artifactPath)
    if (bytes.byteLength !== artifact.bytes
      || createHash('sha256').update(bytes).digest('hex') !== artifact.sha256) {
      throw new Error(`Package artifact does not match signed hash: ${item.id}/${artifact.path}`)
    }
    totalBytes += bytes.byteLength
    if (totalBytes > maxPackageBytes) throw new Error(`Package exceeds WispOS size budget: ${item.id}`)
    paths.add(artifact.path)
  }
  if (!paths.has(manifest.entrypoint)) throw new Error(`Package entrypoint is not a signed artifact: ${item.id}`)
  const sourceArtifacts = [...source.artifactPaths].sort()
  if (canonicalJson(sourceArtifacts) !== canonicalJson([...paths].sort())) {
    throw new Error(`Package source artifact list does not match signed manifest: ${item.id}`)
  }
}

function unsafePath(path) {
  return typeof path !== 'string' || !path || path.length > 512 || path.startsWith('/')
    || path.includes('\\') || /^[a-z]:/i.test(path)
    || path.split('/').some((part) => !part || part === '.' || part === '..')
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
}
