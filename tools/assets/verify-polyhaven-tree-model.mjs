import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const SUPPORTED_PACKS = new Set(['web-1k', 'desktop-2k', 'desktop-4k', 'cinema-8k'])
const SUPPORTED_ASSETS = new Set([
  'tree_small_02',
  'jacaranda_tree',
  'rock_face_01',
  'island_tree_01',
  'fern_02',
  'coast_rocks_05',
  'boulder_01',
])
const ENVIRONMENT_ASSETS = ['island_tree_01', 'fern_02', 'coast_rocks_05', 'boulder_01']

function parseAssets(argumentsList) {
  const assetIndex = argumentsList.indexOf('--asset')
  const slug = assetIndex >= 0 ? argumentsList[assetIndex + 1] : 'tree_small_02'
  if (slug === 'environment') return ENVIRONMENT_ASSETS
  if (!SUPPORTED_ASSETS.has(slug)) throw new Error(`Expected --asset environment, ${[...SUPPORTED_ASSETS].join(', ')}; received ${String(slug)}.`)
  return [slug]
}

function parsePack(argumentsList) {
  const packIndex = argumentsList.indexOf('--pack')
  const pack = packIndex >= 0 ? argumentsList[packIndex + 1] : 'web-1k'
  if (!SUPPORTED_PACKS.has(pack)) throw new Error(`Expected --pack web-1k, desktop-2k, desktop-4k, or cinema-8k; received ${String(pack)}.`)
  return pack
}

function sha256(buffer) {
  return `sha256:${createHash('sha256').update(buffer).digest('hex')}`
}

function runtimePath(projectRoot, pack, slug, path) {
  if (pack === 'web-1k') {
    const expectedPrefix = `/assets/polyhaven/${pack}/models/${slug}/`
    if (!path.startsWith(expectedPrefix)) throw new Error(`Web model path must be local and start with ${expectedPrefix}`)
    return resolve(projectRoot, 'public', path.slice(1))
  }
  const expectedPrefix = `models/${slug}/`
  if (!path.startsWith(expectedPrefix)) throw new Error(`Desktop model path must be relative to ${expectedPrefix}`)
  return resolve(projectRoot, 'desktop-packs', 'polyhaven', pack, path)
}

async function verifyModel(projectRoot, slug, pack) {
  const reportPath = resolve(projectRoot, 'tools', 'assets', 'reports', `${slug}-${pack}.json`)
  const report = JSON.parse(await readFile(reportPath, 'utf8'))
  if (report.pack !== pack || report.asset?.slug !== slug || !Array.isArray(report.variants)) {
    throw new Error(`Invalid tree model report: ${reportPath}`)
  }

  let verifiedBytes = 0
  for (const variant of report.variants) {
    if ('outputPath' in variant) throw new Error(`${variant.id}: report must not contain an absolute build output path.`)
    const path = runtimePath(projectRoot, pack, slug, variant.path)
    const [buffer, fileStat] = await Promise.all([readFile(path), stat(path)])
    if (sha256(buffer) !== variant.processedChecksum) throw new Error(`${variant.id}: processed checksum mismatch.`)
    if (fileStat.size !== variant.processedBytes) throw new Error(`${variant.id}: processed byte count mismatch.`)
    if (!variant.processedPath || /^([A-Za-z]:|\\\\)/.test(variant.processedPath)) {
      throw new Error(`${variant.id}: processed path must remain project-relative.`)
    }
    verifiedBytes += fileStat.size
  }
  if (verifiedBytes !== report.runtimeBytes) throw new Error(`Runtime byte mismatch: ${verifiedBytes} !== ${report.runtimeBytes}`)
  return { asset: slug, variants: report.variants.length, verifiedBytes, sourceBytes: report.sourceBytes }
}

async function main() {
  const argumentsList = process.argv.slice(2)
  const slugs = parseAssets(argumentsList)
  const pack = parsePack(argumentsList)
  const projectRoot = process.cwd()
  const assets = []
  for (const slug of slugs) assets.push(await verifyModel(projectRoot, slug, pack))
  console.log(JSON.stringify({ pack, assets }, null, 2))
}

await main()
