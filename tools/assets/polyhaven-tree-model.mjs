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
    variants: [{ id: 'forest-lod2', simplifyRatio: 0.001, simplifyError: 0.003, textureSize: 1024, intendedUse: 'instanced wide-canopy Web forest tree', maxInstances: 8 }],
  },
  'desktop-2k': {
    resolution: '2k',
    root: ['desktop-packs', 'polyhaven', 'desktop-2k', 'models', JACARANDA_ASSET.slug],
    variants: [{ id: 'forest-lod2', simplifyRatio: 0.001, simplifyError: 0.003, textureSize: 2048, intendedUse: 'instanced wide-canopy desktop forest tree', maxInstances: 8 }],
  },
  'desktop-4k': {
    resolution: '4k',
    root: ['desktop-packs', 'polyhaven', 'desktop-4k', 'models', JACARANDA_ASSET.slug],
    variants: [{ id: 'forest-lod2', simplifyRatio: 0.001, simplifyError: 0.003, textureSize: 4096, intendedUse: 'instanced wide-canopy Ultra forest tree', maxInstances: 8 }],
  },
}

const ROCK_FACE_ASSET = {
  id: 'rock-face-01',
  slug: 'rock_face_01',
  license: 'CC0-1.0',
  attribution: 'Poly Haven — rock_face_01 by Dario Barresi (CC0 1.0)',
  sourceUrl: 'https://polyhaven.com/a/rock_face_01',
}

const ROCK_FACE_PACKS = {
  'web-1k': {
    resolution: '1k',
    root: ['public', 'assets', 'polyhaven', 'web-1k', 'models', ROCK_FACE_ASSET.slug],
    variants: [{ id: 'formation-lod0', simplify: false, textureSize: 1024, intendedUse: 'instanced Web rock formation', maxInstances: 12 }],
  },
  'desktop-2k': {
    resolution: '2k',
    root: ['desktop-packs', 'polyhaven', 'desktop-2k', 'models', ROCK_FACE_ASSET.slug],
    variants: [{ id: 'formation-lod0', simplify: false, textureSize: 2048, intendedUse: 'instanced desktop rock formation', maxInstances: 16 }],
  },
  'desktop-4k': {
    resolution: '4k',
    root: ['desktop-packs', 'polyhaven', 'desktop-4k', 'models', ROCK_FACE_ASSET.slug],
    variants: [{ id: 'formation-lod0', simplify: false, textureSize: 4096, intendedUse: 'instanced Ultra rock formation', maxInstances: 16 }],
  },
}

/**
 * These four models expand the environment beyond the original tree/rock
 * pilot. They were selected from Poly Haven's outdoor collections because
 * each has a real local glTF at all four source resolutions. Keep them
 * sparse and instanced: source texture quality is not a license to place a
 * hero mesh on every simulation tile.
 */
const ISLAND_TREE_ASSET = {
  id: 'island-tree-01',
  slug: 'island_tree_01',
  license: 'CC0-1.0',
  attribution: 'Poly Haven — island_tree_01 (CC0 1.0)',
  sourceUrl: 'https://polyhaven.com/a/island_tree_01',
}

const ISLAND_TREE_PACKS = {
  'web-1k': {
    resolution: '1k',
    root: ['public', 'assets', 'polyhaven', 'web-1k', 'models', ISLAND_TREE_ASSET.slug],
    variants: [{ id: 'forest-lod1', simplifyRatio: 0.012, simplifyError: 0.0025, textureSize: 1024, intendedUse: 'instanced island forest tree', maxInstances: 6 }],
  },
  'desktop-2k': {
    resolution: '2k',
    root: ['desktop-packs', 'polyhaven', 'desktop-2k', 'models', ISLAND_TREE_ASSET.slug],
    variants: [{ id: 'forest-lod1', simplifyRatio: 0.016, simplifyError: 0.002, textureSize: 2048, intendedUse: 'instanced desktop island forest tree', maxInstances: 10 }],
  },
  'desktop-4k': {
    resolution: '4k',
    root: ['desktop-packs', 'polyhaven', 'desktop-4k', 'models', ISLAND_TREE_ASSET.slug],
    variants: [{ id: 'forest-lod1', simplifyRatio: 0.022, simplifyError: 0.0018, textureSize: 4096, intendedUse: 'instanced ultra island forest tree', maxInstances: 14 }],
  },
  'cinema-8k': {
    resolution: '8k',
    root: ['desktop-packs', 'polyhaven', 'cinema-8k', 'models', ISLAND_TREE_ASSET.slug],
    variants: [{ id: 'forest-lod1', simplifyRatio: 0.03, simplifyError: 0.0015, textureSize: 8192, intendedUse: 'instanced cinema island forest tree', maxInstances: 18 }],
  },
}

const FERN_ASSET = {
  id: 'fern-02',
  slug: 'fern_02',
  license: 'CC0-1.0',
  attribution: 'Poly Haven — fern_02 (CC0 1.0)',
  sourceUrl: 'https://polyhaven.com/a/fern_02',
}

const FERN_PACKS = {
  'web-1k': {
    resolution: '1k',
    root: ['public', 'assets', 'polyhaven', 'web-1k', 'models', FERN_ASSET.slug],
    variants: [{ id: 'ground-lod1', simplifyRatio: 0.16, simplifyError: 0.003, textureSize: 1024, intendedUse: 'instanced forest floor fern', maxInstances: 20 }],
  },
  'desktop-2k': {
    resolution: '2k',
    root: ['desktop-packs', 'polyhaven', 'desktop-2k', 'models', FERN_ASSET.slug],
    variants: [{ id: 'ground-lod1', simplifyRatio: 0.2, simplifyError: 0.0025, textureSize: 2048, intendedUse: 'instanced desktop forest floor fern', maxInstances: 36 }],
  },
  'desktop-4k': {
    resolution: '4k',
    root: ['desktop-packs', 'polyhaven', 'desktop-4k', 'models', FERN_ASSET.slug],
    variants: [{ id: 'ground-lod1', simplifyRatio: 0.24, simplifyError: 0.002, textureSize: 4096, intendedUse: 'instanced ultra forest floor fern', maxInstances: 52 }],
  },
  'cinema-8k': {
    resolution: '8k',
    root: ['desktop-packs', 'polyhaven', 'cinema-8k', 'models', FERN_ASSET.slug],
    variants: [{ id: 'ground-lod1', simplifyRatio: 0.28, simplifyError: 0.0015, textureSize: 8192, intendedUse: 'instanced cinema forest floor fern', maxInstances: 72 }],
  },
}

const COAST_ROCKS_ASSET = {
  id: 'coast-rocks-05',
  slug: 'coast_rocks_05',
  license: 'CC0-1.0',
  attribution: 'Poly Haven — coast_rocks_05 (CC0 1.0)',
  sourceUrl: 'https://polyhaven.com/a/coast_rocks_05',
}

const COAST_ROCKS_PACKS = {
  'web-1k': {
    resolution: '1k',
    root: ['public', 'assets', 'polyhaven', 'web-1k', 'models', COAST_ROCKS_ASSET.slug],
    variants: [{ id: 'coast-lod1', simplifyRatio: 0.14, simplifyError: 0.003, textureSize: 1024, intendedUse: 'instanced coastal rock detail', maxInstances: 12 }],
  },
  'desktop-2k': {
    resolution: '2k',
    root: ['desktop-packs', 'polyhaven', 'desktop-2k', 'models', COAST_ROCKS_ASSET.slug],
    variants: [{ id: 'coast-lod1', simplifyRatio: 0.18, simplifyError: 0.0025, textureSize: 2048, intendedUse: 'instanced desktop coastal rock detail', maxInstances: 18 }],
  },
  'desktop-4k': {
    resolution: '4k',
    root: ['desktop-packs', 'polyhaven', 'desktop-4k', 'models', COAST_ROCKS_ASSET.slug],
    variants: [{ id: 'coast-lod1', simplifyRatio: 0.22, simplifyError: 0.002, textureSize: 4096, intendedUse: 'instanced ultra coastal rock detail', maxInstances: 24 }],
  },
  'cinema-8k': {
    resolution: '8k',
    root: ['desktop-packs', 'polyhaven', 'cinema-8k', 'models', COAST_ROCKS_ASSET.slug],
    variants: [{ id: 'coast-lod1', simplifyRatio: 0.28, simplifyError: 0.0015, textureSize: 8192, intendedUse: 'instanced cinema coastal rock detail', maxInstances: 32 }],
  },
}

const BOULDER_ASSET = {
  id: 'boulder-01',
  slug: 'boulder_01',
  license: 'CC0-1.0',
  attribution: 'Poly Haven — boulder_01 (CC0 1.0)',
  sourceUrl: 'https://polyhaven.com/a/boulder_01',
}

const BOULDER_PACKS = {
  'web-1k': {
    resolution: '1k',
    root: ['public', 'assets', 'polyhaven', 'web-1k', 'models', BOULDER_ASSET.slug],
    variants: [{ id: 'formation-lod1', simplifyRatio: 0.16, simplifyError: 0.003, textureSize: 1024, intendedUse: 'instanced hillside boulder', maxInstances: 10 }],
  },
  'desktop-2k': {
    resolution: '2k',
    root: ['desktop-packs', 'polyhaven', 'desktop-2k', 'models', BOULDER_ASSET.slug],
    variants: [{ id: 'formation-lod1', simplifyRatio: 0.2, simplifyError: 0.0025, textureSize: 2048, intendedUse: 'instanced desktop hillside boulder', maxInstances: 16 }],
  },
  'desktop-4k': {
    resolution: '4k',
    root: ['desktop-packs', 'polyhaven', 'desktop-4k', 'models', BOULDER_ASSET.slug],
    variants: [{ id: 'formation-lod1', simplifyRatio: 0.24, simplifyError: 0.002, textureSize: 4096, intendedUse: 'instanced ultra hillside boulder', maxInstances: 20 }],
  },
  'cinema-8k': {
    resolution: '8k',
    root: ['desktop-packs', 'polyhaven', 'cinema-8k', 'models', BOULDER_ASSET.slug],
    variants: [{ id: 'formation-lod1', simplifyRatio: 0.3, simplifyError: 0.0015, textureSize: 8192, intendedUse: 'instanced cinema hillside boulder', maxInstances: 28 }],
  },
}

/**
 * Village props use the same fully-local glTF pipeline as the landscape.
 * Poly Haven has no character rigs or complete village buildings, but these
 * two CC0 models replace the tiny primitive lantern and generic stockpile
 * decoration with authored 3D meshes at every supported source resolution.
 */
const WOODEN_LANTERN_ASSET = {
  id: 'wooden-lantern-01',
  slug: 'wooden_lantern_01',
  license: 'CC0-1.0',
  attribution: 'Poly Haven — wooden_lantern_01 (CC0 1.0)',
  sourceUrl: 'https://polyhaven.com/a/wooden_lantern_01',
}

const WOODEN_LANTERN_PACKS = {
  'web-1k': {
    resolution: '1k',
    root: ['public', 'assets', 'polyhaven', 'web-1k', 'models', WOODEN_LANTERN_ASSET.slug],
    variants: [{ id: 'lantern-lod1', simplifyRatio: 0.28, simplifyError: 0.0025, textureSize: 1024, intendedUse: 'instanced village lantern', maxInstances: 16 }],
  },
  'desktop-2k': {
    resolution: '2k',
    root: ['desktop-packs', 'polyhaven', 'desktop-2k', 'models', WOODEN_LANTERN_ASSET.slug],
    variants: [{ id: 'lantern-lod1', simplifyRatio: 0.34, simplifyError: 0.002, textureSize: 2048, intendedUse: 'instanced desktop village lantern', maxInstances: 24 }],
  },
  'desktop-4k': {
    resolution: '4k',
    root: ['desktop-packs', 'polyhaven', 'desktop-4k', 'models', WOODEN_LANTERN_ASSET.slug],
    variants: [{ id: 'lantern-lod1', simplifyRatio: 0.4, simplifyError: 0.0015, textureSize: 4096, intendedUse: 'instanced ultra village lantern', maxInstances: 32 }],
  },
  'cinema-8k': {
    resolution: '8k',
    root: ['desktop-packs', 'polyhaven', 'cinema-8k', 'models', WOODEN_LANTERN_ASSET.slug],
    variants: [{ id: 'lantern-lod1', simplifyRatio: 0.46, simplifyError: 0.0012, textureSize: 8192, intendedUse: 'instanced cinema village lantern', maxInstances: 40 }],
  },
}

const WOODEN_BARRELS_ASSET = {
  id: 'wooden-barrels-01',
  slug: 'wooden_barrels_01',
  license: 'CC0-1.0',
  attribution: 'Poly Haven — wooden_barrels_01 (CC0 1.0)',
  sourceUrl: 'https://polyhaven.com/a/wooden_barrels_01',
}

const WOODEN_BARRELS_PACKS = {
  'web-1k': {
    resolution: '1k',
    root: ['public', 'assets', 'polyhaven', 'web-1k', 'models', WOODEN_BARRELS_ASSET.slug],
    variants: [{ id: 'stockpile-lod1', simplifyRatio: 0.2, simplifyError: 0.0025, textureSize: 1024, intendedUse: 'instanced village stockpile', maxInstances: 16 }],
  },
  'desktop-2k': {
    resolution: '2k',
    root: ['desktop-packs', 'polyhaven', 'desktop-2k', 'models', WOODEN_BARRELS_ASSET.slug],
    variants: [{ id: 'stockpile-lod1', simplifyRatio: 0.26, simplifyError: 0.002, textureSize: 2048, intendedUse: 'instanced desktop village stockpile', maxInstances: 24 }],
  },
  'desktop-4k': {
    resolution: '4k',
    root: ['desktop-packs', 'polyhaven', 'desktop-4k', 'models', WOODEN_BARRELS_ASSET.slug],
    variants: [{ id: 'stockpile-lod1', simplifyRatio: 0.32, simplifyError: 0.0015, textureSize: 4096, intendedUse: 'instanced ultra village stockpile', maxInstances: 32 }],
  },
  'cinema-8k': {
    resolution: '8k',
    root: ['desktop-packs', 'polyhaven', 'cinema-8k', 'models', WOODEN_BARRELS_ASSET.slug],
    variants: [{ id: 'stockpile-lod1', simplifyRatio: 0.38, simplifyError: 0.0012, textureSize: 8192, intendedUse: 'instanced cinema village stockpile', maxInstances: 40 }],
  },
}

/** A sparse coast structure gives the procedural waterline an authored 3D landmark. */
const MODULAR_WOODEN_PIER_ASSET = {
  id: 'modular-wooden-pier',
  slug: 'modular_wooden_pier',
  license: 'CC0-1.0',
  attribution: 'Poly Haven — modular_wooden_pier (CC0 1.0)',
  sourceUrl: 'https://polyhaven.com/a/modular_wooden_pier',
}

const MODULAR_WOODEN_PIER_PACKS = {
  'web-1k': {
    resolution: '1k',
    root: ['public', 'assets', 'polyhaven', 'web-1k', 'models', MODULAR_WOODEN_PIER_ASSET.slug],
    variants: [{ id: 'coast-dock-lod1', simplifyRatio: 0.04, simplifyError: 0.0025, textureSize: 1024, intendedUse: 'sparse coastal dock landmark', maxInstances: 6 }],
  },
  'desktop-2k': {
    resolution: '2k',
    root: ['desktop-packs', 'polyhaven', 'desktop-2k', 'models', MODULAR_WOODEN_PIER_ASSET.slug],
    variants: [{ id: 'coast-dock-lod1', simplifyRatio: 0.05, simplifyError: 0.002, textureSize: 2048, intendedUse: 'sparse desktop coastal dock landmark', maxInstances: 8 }],
  },
  'desktop-4k': {
    resolution: '4k',
    root: ['desktop-packs', 'polyhaven', 'desktop-4k', 'models', MODULAR_WOODEN_PIER_ASSET.slug],
    variants: [{ id: 'coast-dock-lod1', simplifyRatio: 0.06, simplifyError: 0.0015, textureSize: 4096, intendedUse: 'sparse ultra coastal dock landmark', maxInstances: 12 }],
  },
  'cinema-8k': {
    resolution: '8k',
    root: ['desktop-packs', 'polyhaven', 'cinema-8k', 'models', MODULAR_WOODEN_PIER_ASSET.slug],
    variants: [{ id: 'coast-dock-lod1', simplifyRatio: 0.07, simplifyError: 0.0012, textureSize: 8192, intendedUse: 'sparse cinema coastal dock landmark', maxInstances: 16 }],
  },
}

const CURATED_ASSETS = new Map([
  [ASSET.slug, { asset: ASSET, packs: PACKS }],
  [JACARANDA_ASSET.slug, { asset: JACARANDA_ASSET, packs: JACARANDA_PACKS }],
  [ROCK_FACE_ASSET.slug, { asset: ROCK_FACE_ASSET, packs: ROCK_FACE_PACKS }],
  [ISLAND_TREE_ASSET.slug, { asset: ISLAND_TREE_ASSET, packs: ISLAND_TREE_PACKS }],
  [FERN_ASSET.slug, { asset: FERN_ASSET, packs: FERN_PACKS }],
  [COAST_ROCKS_ASSET.slug, { asset: COAST_ROCKS_ASSET, packs: COAST_ROCKS_PACKS }],
  [BOULDER_ASSET.slug, { asset: BOULDER_ASSET, packs: BOULDER_PACKS }],
  [WOODEN_LANTERN_ASSET.slug, { asset: WOODEN_LANTERN_ASSET, packs: WOODEN_LANTERN_PACKS }],
  [WOODEN_BARRELS_ASSET.slug, { asset: WOODEN_BARRELS_ASSET, packs: WOODEN_BARRELS_PACKS }],
  [MODULAR_WOODEN_PIER_ASSET.slug, { asset: MODULAR_WOODEN_PIER_ASSET, packs: MODULAR_WOODEN_PIER_PACKS }],
])

function checksum(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function md5(buffer) {
  return createHash('md5').update(buffer).digest('hex')
}

function parseAsset(argumentsList) {
  const assetIndex = argumentsList.indexOf('--asset')
  const assetId = assetIndex >= 0 ? argumentsList[assetIndex + 1] : 'tree_small_02'
  const selected = CURATED_ASSETS.get(assetId)
  if (selected) return selected
  throw new Error(`Expected --asset ${[...CURATED_ASSETS.keys()].join(', ')}; received ${String(assetId)}.`)
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
