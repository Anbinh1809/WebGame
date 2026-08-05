import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import sharp from 'sharp'

const USER_AGENT = 'AetheriaAssetPipeline/0.1 (local-curation)'
const API_ROOT = 'https://api.polyhaven.com'
const PACKS = new Map([
  ['web-1k', '1k'],
  ['desktop-2k', '2k'],
  ['desktop-4k', '4k'],
])

const MATERIALS = [
  { id: 'terrain-grass', slug: 'aerial_grass_rock', surface: 'terrainGrass', biome: 'đồng cỏ', useCase: 'grassland and hill terrain material', repeat: [5, 5], maxInstances: 1, residentMiB: 7 },
  { id: 'terrain-forest', slug: 'forest_floor', surface: 'terrainForest', biome: 'rừng', useCase: 'forest terrain material', repeat: [5, 5], maxInstances: 1, residentMiB: 7 },
  { id: 'terrain-rock', slug: 'rocky_terrain_02', surface: 'terrainRock', biome: 'núi', useCase: 'rocky terrain and instanced rocks', repeat: [4, 4], maxInstances: 220, residentMiB: 7 },
  { id: 'terrain-sand', slug: 'coast_sand_02', surface: 'terrainSand', biome: 'bờ cát', useCase: 'coastal terrain material', repeat: [5, 5], maxInstances: 1, residentMiB: 7 },
  { id: 'terrain-snow', slug: 'snow_02', surface: 'terrainSnow', biome: 'tuyết', useCase: 'snow terrain material', repeat: [5, 5], maxInstances: 1, residentMiB: 6 },
  { id: 'tree-foliage', slug: 'leafy_grass', surface: 'foliage', biome: 'rừng', useCase: 'instanced tree foliage', repeat: [1, 2], maxInstances: 240, residentMiB: 6 },
  { id: 'tree-bark', slug: 'bark_brown_02', surface: 'trunk', biome: 'rừng', useCase: 'instanced tree trunks', repeat: [2, 3], maxInstances: 240, residentMiB: 6 },
  { id: 'settlement-wood', slug: 'dark_wooden_planks', surface: 'house', biome: 'settlement', useCase: 'procedural house walls', repeat: [2, 2], maxInstances: 48, residentMiB: 6 },
  { id: 'settlement-roof', slug: 'roof_slates_02', surface: 'roof', biome: 'settlement', useCase: 'procedural roofs', repeat: [2, 2], maxInstances: 48, residentMiB: 6 },
  { id: 'farm-soil', slug: 'brown_mud_dry', surface: 'farm', biome: 'settlement', useCase: 'procedural farms', repeat: [2, 2], maxInstances: 64, residentMiB: 5 },
  { id: 'road-gravel', slug: 'gravel_ground_01', surface: 'road', biome: 'settlement', useCase: 'procedural roads', repeat: [2, 4], maxInstances: 48, residentMiB: 6 },
]

const MAPS = [
  { key: 'albedo', apiKey: 'Diffuse', colorSpace: 'srgb', quality: 84 },
  { key: 'normal', apiKey: 'nor_gl', colorSpace: 'linear', quality: 96 },
  { key: 'roughness', apiKey: 'Rough', colorSpace: 'linear', quality: 90 },
]

const HDRI = { id: 'environment-kloppenheim', slug: 'kloppenheim_02', surface: 'environment', biome: 'global', useCase: 'PMREM environment lighting', maxInstances: 1, residentMiB: 8 }

function parseArguments(argv) {
  const packIndex = argv.indexOf('--pack')
  const pack = packIndex >= 0 ? argv[packIndex + 1] : 'web-1k'
  if (!PACKS.has(pack)) throw new Error(`Unsupported pack: ${pack}. Expected web-1k, desktop-2k, or desktop-4k.`)
  return { pack, resolution: PACKS.get(pack) }
}

function checksum(buffer, algorithm = 'sha256') {
  return createHash(algorithm).update(buffer).digest('hex')
}

function aggregateChecksum(values) {
  return `sha256:${checksum(Buffer.from(values.join('\n')))}`
}

async function readIfValid(filePath, expectedMd5) {
  try {
    const content = await readFile(filePath)
    return checksum(content, 'md5') === expectedMd5 ? content : undefined
  } catch {
    return undefined
  }
}

async function downloadSource(filePath, url, expectedMd5) {
  const cached = await readIfValid(filePath, expectedMd5)
  if (cached) return cached

  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}.`)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (checksum(buffer, 'md5') !== expectedMd5) throw new Error(`Source checksum mismatch for ${url}.`)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, buffer)
  return buffer
}

async function fileMetadata(slug) {
  const response = await fetch(`${API_ROOT}/files/${slug}`, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(`Could not load Poly Haven metadata for ${slug}: HTTP ${response.status}.`)
  return response.json()
}

function sourceFile(metadata, apiKey, resolution, slug) {
  const file = metadata?.[apiKey]?.[resolution]?.jpg
  if (!file?.url || !file?.md5 || !file?.size) {
    throw new Error(`${slug}: ${apiKey}/${resolution}/jpg is unavailable in Poly Haven metadata.`)
  }
  return file
}

function hdriFile(metadata, resolution, slug) {
  const file = metadata?.hdri?.[resolution]?.hdr
  if (!file?.url || !file?.md5 || !file?.size) {
    throw new Error(`${slug}: HDRI ${resolution}/hdr is unavailable in Poly Haven metadata.`)
  }
  return file
}

function runtimeRoot(projectRoot, pack) {
  return pack === 'web-1k'
    ? resolve(projectRoot, 'public', 'assets', 'polyhaven', pack)
    : resolve(projectRoot, 'desktop-packs', 'polyhaven', pack)
}

function publicRuntimePath(projectRoot, outputPath) {
  const publicRoot = resolve(projectRoot, 'public')
  const local = relative(publicRoot, outputPath).replaceAll('\\', '/')
  return `/${local}`
}

function runtimeAssetPath(projectRoot, outputRoot, pack, outputPath) {
  return pack === 'web-1k'
    ? publicRuntimePath(projectRoot, outputPath)
    : relative(outputRoot, outputPath).replaceAll('\\', '/')
}

async function processMaterial(projectRoot, sourceRoot, outputRoot, pack, resolution, material) {
  const metadata = await fileMetadata(material.slug)
  const files = []
  const sourceChecksums = []
  const processedChecksums = []
  let sourceBytes = 0
  let processedBytes = 0

  for (const map of MAPS) {
    const source = sourceFile(metadata, map.apiKey, resolution, material.slug)
    const sourcePath = resolve(sourceRoot, material.slug, `${map.key}.jpg`)
    const input = await downloadSource(sourcePath, source.url, source.md5)
    const outputPath = resolve(outputRoot, material.slug, `${map.key}.webp`)
    await mkdir(dirname(outputPath), { recursive: true })
    await sharp(input, { animated: false }).webp({ quality: map.quality, effort: 4 }).toFile(outputPath)
    const output = await readFile(outputPath)
    const info = await sharp(output).metadata()
    const sourceSha = `sha256:${checksum(input)}`
    const processedSha = `sha256:${checksum(output)}`
    sourceChecksums.push(`${map.key}:${sourceSha}`)
    processedChecksums.push(`${map.key}:${processedSha}`)
    sourceBytes += input.byteLength
    processedBytes += output.byteLength
    files.push({
      role: map.key,
      sourceUrl: source.url,
      sourceChecksum: sourceSha,
      processedChecksum: processedSha,
      sourceBytes: input.byteLength,
      runtimeBytes: output.byteLength,
      runtimePath: runtimeAssetPath(projectRoot, outputRoot, pack, outputPath),
      colorSpace: map.colorSpace,
      width: info.width,
      height: info.height,
    })
  }

  return {
    id: `${material.id}-${pack}`,
    surface: material.surface,
    provider: 'polyhaven',
    polyHavenSlug: material.slug,
    sourceUrl: `https://polyhaven.com/a/${material.slug}`,
    license: 'CC0-1.0',
    attribution: `Poly Haven — ${material.slug} (CC0 1.0)`,
    biome: material.biome,
    useCase: material.useCase,
    repeat: material.repeat,
    sourceChecksum: aggregateChecksum(sourceChecksums),
    processedChecksum: aggregateChecksum(processedChecksums),
    fileSizes: { sourceBytes, processedBytes, runtimeBytes: processedBytes },
    runtimeBudget: { maxInstances: material.maxInstances, residentMiB: material.residentMiB, preload: true, intendedUse: material.useCase },
    files,
  }
}

async function processHdri(projectRoot, sourceRoot, outputRoot, pack, resolution) {
  const metadata = await fileMetadata(HDRI.slug)
  const source = hdriFile(metadata, resolution, HDRI.slug)
  const sourcePath = resolve(sourceRoot, HDRI.slug, 'environment.hdr')
  const input = await downloadSource(sourcePath, source.url, source.md5)
  const outputPath = resolve(outputRoot, HDRI.slug, 'environment.hdr')
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, input)
  const sha = `sha256:${checksum(input)}`
  return {
    id: `${HDRI.id}-${pack}`,
    surface: HDRI.surface,
    provider: 'polyhaven',
    polyHavenSlug: HDRI.slug,
    sourceUrl: `https://polyhaven.com/a/${HDRI.slug}`,
    license: 'CC0-1.0',
    attribution: `Poly Haven — ${HDRI.slug} (CC0 1.0)`,
    biome: HDRI.biome,
    useCase: HDRI.useCase,
    sourceChecksum: sha,
    processedChecksum: sha,
    fileSizes: { sourceBytes: input.byteLength, processedBytes: input.byteLength, runtimeBytes: input.byteLength },
    runtimeBudget: { maxInstances: HDRI.maxInstances, residentMiB: HDRI.residentMiB, preload: true, intendedUse: HDRI.useCase },
    files: [{
      role: 'environment',
      sourceUrl: source.url,
      sourceChecksum: sha,
      processedChecksum: sha,
      sourceBytes: input.byteLength,
      runtimeBytes: input.byteLength,
      runtimePath: runtimeAssetPath(projectRoot, outputRoot, pack, outputPath),
      colorSpace: 'linear',
      width: undefined,
      height: undefined,
    }],
  }
}

async function main() {
  const { pack, resolution } = parseArguments(process.argv.slice(2))
  const projectRoot = process.cwd()
  const sourceRoot = resolve(projectRoot, '.asset-cache', 'polyhaven', pack)
  const outputRoot = runtimeRoot(projectRoot, pack)
  const entries = []
  for (const material of MATERIALS) entries.push(await processMaterial(projectRoot, sourceRoot, outputRoot, pack, resolution, material))
  entries.push(await processHdri(projectRoot, sourceRoot, outputRoot, pack, resolution))

  const report = {
    schemaVersion: 1,
    pack,
    sourceResolution: resolution,
    runtimeRoot: relative(projectRoot, outputRoot).replaceAll('\\', '/'),
    sourceCache: relative(projectRoot, sourceRoot).replaceAll('\\', '/'),
    runtimeBytes: entries.reduce((total, entry) => total + entry.fileSizes.runtimeBytes, 0),
    entries,
  }
  const packManifest = entries.map((entry) => ({
    id: entry.id,
    biome: entry.biome,
    useCase: entry.useCase,
    deterministicVariants: [entry.polyHavenSlug],
    provider: entry.provider,
    polyHavenSlug: entry.polyHavenSlug,
    sourceUrl: entry.sourceUrl,
    license: entry.license,
    attribution: entry.attribution,
    sourceChecksum: entry.sourceChecksum,
    processedChecksum: entry.processedChecksum,
    pack,
    fileSizes: entry.fileSizes,
    lods: [
      { id: 'lod0', triangles: 0, available: true },
      { id: 'lod1', triangles: 0, available: true },
      { id: 'lod2', triangles: 0, available: true },
    ],
    fallback: 'procedural',
    runtimeBudget: entry.runtimeBudget,
    runtime: {
      kind: entry.surface === 'environment' ? 'environment' : 'material',
      surface: entry.surface,
      ...(entry.repeat ? { repeat: entry.repeat } : {}),
      files: entry.files.map((file) => ({ role: file.role, path: file.runtimePath, colorSpace: file.colorSpace })),
    },
  }))
  const reportPath = resolve(projectRoot, 'tools', 'assets', 'reports', `polyhaven-${pack}.json`)
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(resolve(outputRoot, 'manifest.json'), `${JSON.stringify(packManifest, null, 2)}\n`)
  console.log(JSON.stringify({ pack, runtimeBytes: report.runtimeBytes, outputRoot: report.runtimeRoot, report: relative(projectRoot, reportPath).replaceAll('\\', '/') }, null, 2))
}

await main()
