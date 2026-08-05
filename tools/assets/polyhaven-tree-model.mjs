import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const USER_AGENT = 'AetheriaAssetPipeline/0.2 (tree-lod-curation)'
const API_ROOT = 'https://api.polyhaven.com'
const ASSET = {
  id: 'tree-small-02',
  slug: 'tree_small_02',
  license: 'CC0-1.0',
  attribution: 'Poly Haven — tree_small_02 by Rico Cilliers (CC0 1.0)',
  sourceUrl: 'https://polyhaven.com/a/tree_small_02',
}

const PACKS = {
  'web-1k': {
    resolution: '1k',
    root: ['public', 'assets', 'polyhaven', 'web-1k', 'models', ASSET.slug],
    variants: [{ id: 'forest-lod2', simplifyRatio: 0.004, simplifyError: 0.003, textureSize: 1024, intendedUse: 'instanced forest tree', maxInstances: 512 }],
  },
  'desktop-2k': {
    resolution: '2k',
    root: ['desktop-packs', 'polyhaven', 'desktop-2k', 'models', ASSET.slug],
    variants: [{ id: 'forest-lod2', simplifyRatio: 0.004, simplifyError: 0.003, textureSize: 2048, intendedUse: 'instanced desktop forest tree', maxInstances: 512 }],
  },
  'desktop-4k': {
    resolution: '4k',
    root: ['desktop-packs', 'polyhaven', 'desktop-4k', 'models', ASSET.slug],
    variants: [
      { id: 'forest-lod2', simplifyRatio: 0.004, simplifyError: 0.003, textureSize: 4096, intendedUse: 'instanced ultra forest tree', maxInstances: 512 },
      { id: 'hero-lod0', simplifyRatio: 0.12, simplifyError: 0.0015, textureSize: 4096, intendedUse: 'near-camera photo-mode tree', maxInstances: 3 },
    ],
  },
}

const JACARANDA_ASSET = {
  id: 'jacaranda-tree',
  slug: 'jacaranda_tree',
  license: 'CC0-1.0',
  attribution: 'Poly Haven — jacaranda_tree (CC0 1.0)',
  sourceUrl: 'https://polyhaven.com/a/jacaranda_tree',
}

const JACARANDA_PACKS = {
  'web-1k': {
    resolution: '1k',
    root: ['public', 'assets', 'polyhaven', 'web-1k', 'models', JACARANDA_ASSET.slug],
    // Jacaranda is already a 312K-triangle wide-canopy tree. Keeping that
    // geometry preserves its leaf silhouette at the isometric game distance.
    variants: [{ id: 'forest-lod1', simplifyRatio: 0.01, simplifyError: 0.002, textureSize: 1024, intendedUse: 'instanced wide-canopy Web forest tree', maxInstances: 8 }],
  },
  'desktop-2k': {
    resolution: '2k',
    root: ['desktop-packs', 'polyhaven', 'desktop-2k', 'models', JACARANDA_ASSET.slug],
    variants: [{ id: 'forest-lod1', simplifyRatio: 0.01, simplifyError: 0.002, textureSize: 2048, intendedUse: 'instanced wide-canopy desktop forest tree', maxInstances: 10 }],
  },
  'desktop-4k': {
    resolution: '4k',
    root: ['desktop-packs', 'polyhaven', 'desktop-4k', 'models', JACARANDA_ASSET.slug],
    variants: [{ id: 'forest-lod1', simplifyRatio: 0.01, simplifyError: 0.002, textureSize: 4096, intendedUse: 'instanced wide-canopy Ultra forest tree', maxInstances: 10 }],
  },
}

function checksum(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function md5(buffer) {
  return createHash('md5').update(buffer).digest('hex')
}

function parseAsset(argumentsList) {
  const assetIndex = argumentsList.indexOf('--asset')
  const assetId = assetIndex >= 0 ? argumentsList[assetIndex + 1] : 'tree_small_02'
  if (assetId === 'tree_small_02') return { asset: ASSET, packs: PACKS }
  if (assetId === 'jacaranda_tree') return { asset: JACARANDA_ASSET, packs: JACARANDA_PACKS }
  throw new Error(`Expected --asset tree_small_02 or jacaranda_tree; received ${String(assetId)}.`)
}

function parsePack(argumentsList, packs) {
  const packIndex = argumentsList.indexOf('--pack')
  const pack = packIndex >= 0 ? argumentsList[packIndex + 1] : 'web-1k'
  if (!(pack in packs)) throw new Error(`Expected --pack ${Object.keys(packs).join(', ')}; received ${String(pack)}.`)
  return pack
}

async function readIfValid(filePath, expectedMd5) {
  try {
    const value = await readFile(filePath)
    return md5(value) === expectedMd5 ? value : undefined
  } catch {
    return undefined
  }
}

async function downloadSource(filePath, descriptor) {
  const cached = await readIfValid(filePath, descriptor.md5)
  if (cached) return cached
  const response = await fetch(descriptor.url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(`Could not download ${descriptor.url}: HTTP ${response.status}.`)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (md5(buffer) !== descriptor.md5) throw new Error(`MD5 mismatch for ${descriptor.url}.`)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, buffer)
  return buffer
}

async function metadata(asset) {
  const response = await fetch(`${API_ROOT}/files/${asset.slug}`, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(`Could not load Poly Haven metadata for ${asset.slug}: HTTP ${response.status}.`)
  return response.json()
}

async function collectSource(projectRoot, asset, config) {
  const assetMetadata = await metadata(asset)
  const gltf = assetMetadata?.gltf?.[config.resolution]?.gltf
  if (!gltf?.url || !gltf?.md5 || !gltf?.include) throw new Error(`${asset.slug}: glTF ${config.resolution} is unavailable.`)
  const sourceRoot = resolve(projectRoot, '.asset-cache', 'polyhaven-models', asset.slug, config.resolution)
  const gltfName = gltf.url.split('/').at(-1)
  if (!gltfName) throw new Error('Could not resolve glTF source filename.')
  const descriptors = [
    { relativePath: gltfName, descriptor: gltf },
    ...Object.entries(gltf.include).map(([relativePath, descriptor]) => ({ relativePath, descriptor })),
  ]
  const sourceFiles = []
  for (const source of descriptors) {
    const input = await downloadSource(resolve(sourceRoot, source.relativePath), source.descriptor)
    sourceFiles.push({
      path: source.relativePath.replaceAll('\\', '/'),
      sourceUrl: source.descriptor.url,
      sourceMd5: source.descriptor.md5,
      sourceChecksum: `sha256:${checksum(input)}`,
      sourceBytes: input.byteLength,
    })
  }
  return { sourceRoot, gltfPath: resolve(sourceRoot, gltfName), sourceFiles }
}

async function optimize(projectRoot, inputPath, outputPath, variant) {
  await mkdir(dirname(outputPath), { recursive: true })
  const cliEntry = resolve(projectRoot, 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js')
  const args = [
    'optimize', inputPath, outputPath,
    '--compress', 'meshopt',
    '--meshopt-level', 'high',
    '--flatten', 'false',
    '--join', 'false',
    '--instance', 'false',
    '--simplify', variant.simplify === false ? 'false' : 'true',
    // Preserve the source JPG maps here. Poly Haven's packed leaf maps have a
    // color-space marker that libvips on this Windows runtime cannot safely
    // rewrite to WebP; lossy conversion would be worse than shipping the
    // verified source maps inside this model GLB.
    '--texture-compress', 'false',
  ]
  if (variant.simplify !== false) {
    args.push('--simplify-ratio', String(variant.simplifyRatio), '--simplify-error', String(variant.simplifyError))
  }
  await execFileAsync(process.execPath, [cliEntry, ...args], { cwd: projectRoot, windowsHide: true, maxBuffer: 2 * 1024 * 1024 })
  const output = await readFile(outputPath)
  return { outputPath, processedChecksum: `sha256:${checksum(output)}`, processedBytes: output.byteLength }
}

function publicRuntimePath(projectRoot, outputPath) {
  return `/${relative(resolve(projectRoot, 'public'), outputPath).replaceAll('\\', '/')}`
}

async function main() {
  const { asset, packs } = parseAsset(process.argv.slice(2))
  const pack = parsePack(process.argv.slice(2), packs)
  const projectRoot = process.cwd()
  const config = packs[pack]
  const { sourceRoot, gltfPath, sourceFiles } = await collectSource(projectRoot, asset, config)
  const outputRoot = resolve(projectRoot, ...config.root)
  const variants = []
  for (const variant of config.variants) {
    const outputPath = resolve(outputRoot, `${asset.slug}_${variant.id}.glb`)
    const { outputPath: processedOutputPath, ...processed } = await optimize(projectRoot, gltfPath, outputPath, variant)
    variants.push({
      ...variant,
      path: pack === 'web-1k'
        ? publicRuntimePath(projectRoot, processedOutputPath)
        : relative(resolve(projectRoot, 'desktop-packs', 'polyhaven', pack), processedOutputPath).replaceAll('\\', '/'),
      processedPath: relative(projectRoot, processedOutputPath).replaceAll('\\', '/'),
      ...processed,
    })
  }
  const sourceBytes = sourceFiles.reduce((total, file) => total + file.sourceBytes, 0)
  const runtimeBytes = variants.reduce((total, variant) => total + variant.processedBytes, 0)
  const manifest = {
    schemaVersion: 1,
    asset,
    pack,
    textureSourceResolution: config.resolution,
    sourceCache: relative(projectRoot, sourceRoot).replaceAll('\\', '/'),
    sourceFiles,
    sourceBytes,
    runtimeBytes,
    variants,
  }
  await writeFile(resolve(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  const reportPath = resolve(projectRoot, 'tools', 'assets', 'reports', `${asset.slug}-${pack}.json`)
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(JSON.stringify({ asset: asset.slug, pack, sourceBytes, runtimeBytes, variants: variants.map(({ id, processedBytes, path }) => ({ id, processedBytes, path })), report: relative(projectRoot, reportPath).replaceAll('\\', '/') }, null, 2))
}

await main()
