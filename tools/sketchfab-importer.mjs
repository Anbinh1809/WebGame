import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

function extractZip(zipPath, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true })
  if (process.platform === 'win32') {
    execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${targetDir}' -Force`,
    ])
  } else {
    execFileSync('unzip', ['-o', zipPath, '-d', targetDir])
  }
}

// Load environment variables from .env if present
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=')
      const val = vals.join('=').trim().replace(/^["']|["']$/g, '')
      if (key && !process.env[key.trim()]) {
        process.env[key.trim()] = val
      }
    }
  }
}

const API_BASE = 'https://api.sketchfab.com/v3'
const token = process.env.SKETCHFAB_API_TOKEN || process.argv.find((a) => a.startsWith('--token='))?.split('=')[1]

function getHeaders() {
  if (!token) {
    console.error('❌ Chưa tìm thấy SKETCHFAB_API_TOKEN!')
    console.log('👉 Hãy lấy API token miễn phí tại: https://sketchfab.com/settings/password')
    console.log('👉 Sau đó thêm vào file .env: SKETCHFAB_API_TOKEN=your_token_here')
    console.log('👉 Hoặc chạy lệnh với tham số: --token=your_token_here\n')
    process.exit(1)
  }
  return {
    Authorization: `Token ${token}`,
    'User-Agent': 'Aetheria-World-Shaper/1.0',
  }
}

function extractUid(input) {
  if (!input) return undefined
  // If it's a full URL like https://sketchfab.com/3d-models/old-wizard-38c2e64627b049d59a8c6db2251a37c3
  const urlMatch = input.match(/([a-f0-9]{32})/i)
  if (urlMatch) return urlMatch[1]
  return input.trim()
}

async function searchModels(query, count = 10) {
  const url = `${API_BASE}/search?type=models&downloadable=true&q=${encodeURIComponent(query)}&count=${count}`
  console.log(`🔍 Đang tìm kiếm model downloadable trên Sketchfab: "${query}"...`)
  const response = await fetch(url, { headers: getHeaders() })
  if (!response.ok) {
    throw new Error(`Tìm kiếm thất bại (${response.status} ${response.statusText})`)
  }
  const data = await response.json()
  console.log(`\n✨ Tìm thấy ${data.results?.length || 0} kết quả:`)
  for (const item of data.results || []) {
    console.log(`--------------------------------------------------`)
    console.log(`📦 Tên: ${item.name}`)
    console.log(`🔑 UID: ${item.uid}`)
    console.log(`👤 Tác giả: ${item.user?.displayName || item.user?.username}`)
    console.log(`📜 Giấy phép: ${item.license?.label || 'CC'}`)
    console.log(`🔗 Link: ${item.viewerUrl}`)
    console.log(`📥 Lệnh tải nhanh: node tools/sketchfab-importer.mjs download ${item.uid} --category=settlements --name=${item.slug || 'model'}`)
  }
  console.log(`--------------------------------------------------\n`)
}

async function downloadModel(uidOrUrl, category = 'settlements', customName = '') {
  const uid = extractUid(uidOrUrl)
  if (!uid) {
    throw new Error('Vui lòng cung cấp UID hoặc URL model Sketchfab hợp lệ.')
  }

  console.log(`📡 Đang kết nối Sketchfab API để lấy link tải cho UID: ${uid}...`)

  // 1. Get model details
  const detailRes = await fetch(`${API_BASE}/models/${uid}`, { headers: getHeaders() })
  let modelName = customName
  if (detailRes.ok) {
    const detailData = await detailRes.json()
    if (!modelName) modelName = detailData.slug || detailData.name.toLowerCase().replace(/[^a-z0-9]/g, '_')
    console.log(`🎯 Model: "${detailData.name}" (Bản quyền: ${detailData.license?.label || 'CC'})`)
  } else {
    if (!modelName) modelName = `sketchfab_${uid.slice(0, 8)}`
  }

  // 2. Request download links
  const dlRes = await fetch(`${API_BASE}/models/${uid}/download`, { headers: getHeaders() })
  if (!dlRes.ok) {
    if (dlRes.status === 401 || dlRes.status === 403) {
      throw new Error(`Không có quyền tải model này (có thể model không miễn phí hoặc token hết hạn). Status: ${dlRes.status}`)
    }
    throw new Error(`Không thể lấy link tải (${dlRes.status} ${dlRes.statusText})`)
  }

  const dlData = await dlRes.json()
  const gltfInfo = dlData.gltf || dlData.glb
  if (!gltfInfo || !gltfInfo.url) {
    throw new Error('Không tìm thấy định dạng GLTF/GLB cho model này trên Sketchfab.')
  }

  console.log(`⬇️ Đang tải file zip (${(gltfInfo.size / 1024 / 1024).toFixed(2)} MB)...`)
  const fileRes = await fetch(gltfInfo.url)
  if (!fileRes.ok) {
    throw new Error(`Tải tệp zip thất bại (${fileRes.status} ${fileRes.statusText})`)
  }

  const tempZipPath = path.join(process.cwd(), `temp_${uid}.zip`)
  const arrayBuffer = await fileRes.arrayBuffer()
  fs.writeFileSync(tempZipPath, Buffer.from(arrayBuffer))

  console.log(`📦 Đang giải nén và cấu trúc thư mục...`)
  const targetDir = path.join(process.cwd(), 'public', 'assets', 'models', category, modelName)
  extractZip(tempZipPath, targetDir)

  // Remove temporary zip
  fs.unlinkSync(tempZipPath)

  console.log(`\n🎉 ĐÃ TẢI & TÍCH HỢP THÀNH CÔNG!`)
  console.log(`📁 Đường dẫn thư mục: public/assets/models/${category}/${modelName}/`)
  console.log(`🚀 Bạn có thể sử dụng ngay model này trong game!`)
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (!command || command === 'help' || command === '--help') {
    console.log(`
=====================================================
🚀 AETHERIA SKETCHFAB API AUTO-IMPORTER TOOL
=====================================================
Sử dụng công cụ này để tìm kiếm và tự động tải 3D models từ Sketchfab trực tiếp vào game!

CÁCH SỬ DỤNG:
1. Tìm kiếm model:
   node tools/sketchfab-importer.mjs search "medieval tavern"

2. Tải model bằng URL hoặc UID:
   node tools/sketchfab-importer.mjs download <URL_HOAC_UID> --category=settlements --name=tavern

CÁC CATEGORY HỖ TRỢ:
- settlements (nhà cửa, làng mạc, lâu đài, lò rèn)
- monsters (rồng, golem, quái vật, werewolf)
- animals (hươu, ngựa, gấu, sói, voi)
- characters (pháp sư, hiệp sĩ, dân làng)
- ships (tàu chiến, thuyền bè)
- weapons (kiếm, khiên, cung tên, trượng)
- tools (cuốc, xẻng, đe rèn, búa)
=====================================================
`)
    return
  }

  if (command === 'search') {
    const query = args[1] || 'medieval'
    await searchModels(query)
  } else if (command === 'download') {
    const input = args[1]
    if (!input) {
      console.error('❌ Vui lòng nhập UID hoặc URL của model Sketchfab!')
      return
    }
    const categoryArg = args.find((a) => a.startsWith('--category='))?.split('=')[1] || 'settlements'
    const nameArg = args.find((a) => a.startsWith('--name='))?.split('=')[1] || ''
    await downloadModel(input, categoryArg, nameArg)
  } else {
    console.log(`Lệnh không hợp lệ: "${command}". Hãy dùng "search" hoặc "download".`)
  }
}

main().catch((err) => {
  console.error('\n❌ LỖI:', err.message)
  process.exit(1)
})
