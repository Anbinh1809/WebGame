import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const SUPPORTED_PACKS = new Set(['web-1k', 'desktop-2k', 'desktop-4k'])
const SLUG = 'tree_small_02'

function parsePack(argumentsList) {
  const packIndex = argumentsList.indexOf('--pack')
  const pack = packIndex >= 0 ? argumentsList[packIndex + 1] : 'web-1k'
  if (!SUPPORTED_PACKS.has(pack)) throw new Error(`Expected --pack web-1k, desktop-2k, or desktop-4k; received ${String(pack)}.`)
  return pack
}

function sha256(buffer) {
  return `sha256:${createHash('sha256').update(buffer).digest('hex')}`
}

function runtimePath(projectRoot, pack, path) {
  if (pack === 'web-1k') {
    const expectedPrefix = `/assets/polyhaven/${pack}/models/${SLUG}/`
    if (!path.startsWith(expectedPrefix)) throw new Error(`Web model path must be local and start with ${expectedPrefix}`)
    return resolve(projectRoot, 'public', path.slice(1))
  }
  const expectedPrefix = `models/${SLUG}/`
  if (!path.startsWith(expectedPrefix)) throw new Error(`Desktop model path must be relative to ${expectedPrefix}`)
  return resolve(projectRoot, 'desktop-packs', 'polyhaven', pack, path)
}

async function main() {
  const pack = parsePack(process.argv.slice(2))
  const projectRoot = process.cwd()
  const reportPath = resolve(projectRoot, 'tools', 'assets', 'reports', `${SLUG}-${pack}.json`)
  const report = JSON.parse(await readFile(reportPath, 'utf8'))
  if (report.pack !== pack || report.asset?.slug !== SLUG || !Array.isArray(report.variants)) {
    throw new Error(`Invalid tree model report: ${reportPath}`)
  }

  let verifiedBytes = 0
  for (const variant of report.variants) {
    if ('outputPath' in variant) throw new Error(`${variant.id}: report must not contain an absolute build output path.`)
    const path = runtimePath(projectRoot, pack, variant.path)
    const [buffer, fileStat] = await Promise.all([readFile(path), stat(path)])
    if (sha256(buffer) !== variant.processedChecksum) throw new Error(`${variant.id}: processed checksum mismatch.`)
    if (fileStat.size !== variant.processedBytes) throw new Error(`${variant.id}: processed byte count mismatch.`)
    if (!variant.processedPath || /^([A-Za-z]:|\\\\)/.test(variant.processedPath)) {
      throw new Error(`${variant.id}: processed path must remain project-relative.`)
    }
    verifiedBytes += fileStat.size
  }
  if (verifiedBytes !== report.runtimeBytes) throw new Error(`Runtime byte mismatch: ${verifiedBytes} !== ${report.runtimeBytes}`)
  console.log(JSON.stringify({ pack, variants: report.variants.length, verifiedBytes, sourceBytes: report.sourceBytes }, null, 2))
}

await main()
