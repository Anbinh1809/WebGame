import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const SUPPORTED_PACKS = new Set(['web-1k', 'desktop-2k', 'desktop-4k'])
const WEB_INITIAL_BUDGET_BYTES = 25 * 1024 * 1024

function parsePack(argumentsList) {
  const packIndex = argumentsList.indexOf('--pack')
  const pack = packIndex >= 0 ? argumentsList[packIndex + 1] : 'web-1k'
  if (!SUPPORTED_PACKS.has(pack)) throw new Error(`Expected --pack web-1k, desktop-2k, or desktop-4k; received ${String(pack)}.`)
  return pack
}

function sha256(buffer) {
  return `sha256:${createHash('sha256').update(buffer).digest('hex')}`
}

function assetPath(projectRoot, pack, runtimePath) {
  if (pack === 'web-1k') return resolve(projectRoot, 'public', runtimePath.replace(/^\//, ''))
  return resolve(projectRoot, 'desktop-packs', 'polyhaven', pack, runtimePath)
}

function packRoot(projectRoot, pack) {
  return pack === 'web-1k'
    ? resolve(projectRoot, 'public', 'assets', 'polyhaven', pack)
    : resolve(projectRoot, 'desktop-packs', 'polyhaven', pack)
}

async function main() {
  const pack = parsePack(process.argv.slice(2))
  const projectRoot = process.cwd()
  const reportPath = resolve(projectRoot, 'tools', 'assets', 'reports', `polyhaven-${pack}.json`)
  const report = JSON.parse(await readFile(reportPath, 'utf8'))
  if (report.pack !== pack || !Array.isArray(report.entries)) throw new Error(`Invalid report: ${reportPath}`)
  const runtimeManifest = JSON.parse(await readFile(resolve(packRoot(projectRoot, pack), 'manifest.json'), 'utf8'))
  if (!Array.isArray(runtimeManifest) || runtimeManifest.length !== report.entries.length) {
    throw new Error(`Runtime manifest does not match report entry count for ${pack}.`)
  }
  const expectedIds = new Set(report.entries.map((entry) => entry.id))
  const expectedPaths = new Set(report.entries.flatMap((entry) => entry.files.map((file) => file.runtimePath)))
  for (const entry of runtimeManifest) {
    if (!expectedIds.has(entry.id)) throw new Error(`Runtime manifest contains an unexpected asset id: ${String(entry.id)}`)
    for (const file of entry.runtime?.files ?? []) {
      if (/^(?:https?:)?\/\//.test(file.path) || !expectedPaths.has(file.path)) {
        throw new Error(`Runtime manifest contains an invalid local asset path: ${String(file.path)}`)
      }
    }
  }

  let verifiedBytes = 0
  let verifiedFiles = 0
  for (const entry of report.entries) {
    for (const file of entry.files) {
      const path = assetPath(projectRoot, pack, file.runtimePath)
      const [buffer, fileStat] = await Promise.all([readFile(path), stat(path)])
      const checksum = sha256(buffer)
      if (checksum !== file.processedChecksum) throw new Error(`${entry.id}: hash mismatch for ${file.runtimePath}`)
      if (fileStat.size !== file.runtimeBytes) throw new Error(`${entry.id}: byte mismatch for ${file.runtimePath}`)
      verifiedBytes += fileStat.size
      verifiedFiles += 1
    }
  }

  if (verifiedBytes !== report.runtimeBytes) throw new Error(`Report runtime byte mismatch: ${verifiedBytes} !== ${report.runtimeBytes}`)
  if (pack === 'web-1k' && verifiedBytes > WEB_INITIAL_BUDGET_BYTES) {
    throw new Error(`Web 1K pack exceeds ${WEB_INITIAL_BUDGET_BYTES} bytes: ${verifiedBytes}.`)
  }
  console.log(JSON.stringify({ pack, verifiedManifestEntries: runtimeManifest.length, verifiedFiles, verifiedBytes, webBudgetBytes: pack === 'web-1k' ? WEB_INITIAL_BUDGET_BYTES : undefined }, null, 2))
}

await main()
