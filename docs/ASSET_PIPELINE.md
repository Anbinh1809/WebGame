# Aetheria asset pipeline

## Release boundary

Asset source quality is independent from render quality:

| Pack | Edition | Intended texture source | Loading rule |
| --- | --- | ---: | --- |
| `web-1k` | Web Demo | 1024px, fallback 512px | Initial game asset payload budget: <= 25 MiB; never preload desktop packs. |
| `desktop-2k` | Desktop | 2048px | Load on demand. |
| `desktop-4k` | Desktop Ultra | 4096px | Near/camera-needed material only; LOD, mipmaps and culling required. |
| `cinema-8k` | Cinema/photo mode | 8192px | Limited hero materials only; capability/VRAM check and 4K/2K fallback required. |

The client is not a DRM boundary. It can select only legitimately delivered files; a production entitlement service must authorize signed, expiring download URLs server-side.

## Manual curation flow

1. An owner selects a Poly Haven asset deliberately. Do not scrape website HTML, thumbnails or metadata.
2. Record the Poly Haven slug/source URL, `CC0-1.0` license, attribution, use case and deterministic variants in `src/assets/manifest.ts`.
3. Keep source binary outside the runtime build and do not commit a large source archive without owner approval.
4. Normalize pivot, scale, orientation and material names. Produce LOD0/LOD1/LOD2 rather than instancing a raw hero mesh.
5. Export runtime GLB/glTF as appropriate. Test geometry compression decode time and visual quality before adopting it.
6. Convert runtime texture maps to KTX2/BasisU (or a tested GPU-compressed equivalent), generate mipmaps, and verify color spaces: albedo/emissive sRGB; normal/roughness/metalness/AO linear. Tileable-material pilot assets use WebP transport plus WebGL mipmaps. The Tree Small 02 GLBs currently preserve verified upstream JPG maps because this Windows libvips build cannot safely rewrite the packed leaf maps; KTX2/BasisU remains a release-gate optimization before shipping larger desktop packs.
7. Hash source and processed files with SHA-256, record bytes and validate dimensions/fallback/runtime budget.
8. Run the asset manifest validator, rendering metrics and visual review on the pilot biome before expansion.

No game runtime may hotlink Poly Haven. All release files must come from Aetheria-controlled packaging or an owner-approved CDN.

## Current license ledger

The curated Web 1K runtime binary is local at `public/assets/polyhaven/web-1k/`; raw sources stay in ignored `.asset-cache/`.

`tools/assets/reports/polyhaven-web-1k.json` carries per-file upstream and processed checksums/sizes for tileable materials. `tools/assets/reports/tree_small_02-<pack>.json` carries the corresponding tree-model ledger. `npm.cmd run assets:verify` verifies materials; `npm.cmd run assets:verify:tree -- --pack <pack>` verifies model GLB hashes and byte counts.

| Poly Haven slug | License | Use case | Source bytes | Runtime bytes | Pack |
| --- | --- | --- | ---: | ---: | --- |
| `aerial_grass_rock` | CC0-1.0 | grass/hill terrain | 1,933,825 | 996,438 | `web-1k` |
| `forest_floor` | CC0-1.0 | forest terrain | 3,446,310 | 1,491,898 | `web-1k` |
| `rocky_terrain_02` | CC0-1.0 | rocky terrain + instanced rocks | 2,273,974 | 794,484 | `web-1k` |
| `coast_sand_02` | CC0-1.0 | coastal terrain | 2,517,211 | 952,816 | `web-1k` |
| `snow_02` | CC0-1.0 | snow terrain | 1,553,444 | 702,060 | `web-1k` |
| `leafy_grass` | CC0-1.0 | reserved ground-cover foliage material | 3,172,828 | 1,270,028 | `web-1k` |
| `bark_brown_02` | CC0-1.0 | instanced tree trunks | 2,013,161 | 1,019,964 | `web-1k` |
| `dark_wooden_planks` | CC0-1.0 | procedural house walls | 2,033,633 | 702,064 | `web-1k` |
| `roof_slates_02` | CC0-1.0 | procedural roofs | 1,585,908 | 814,034 | `web-1k` |
| `brown_mud_dry` | CC0-1.0 | farms | 2,849,933 | 1,478,624 | `web-1k` |
| `gravel_ground_01` | CC0-1.0 | roads | 2,648,174 | 1,351,678 | `web-1k` |
| `kloppenheim_02` | CC0-1.0 | PMREM environment lighting | 1,740,414 | 1,740,414 | `web-1k` |
| `tree_small_02` (Rico Cilliers) | CC0-1.0 | instanced forest Tree LOD2, 83,345 triangles/model | 100,974,143 | 7,047,448 | `web-1k` |

Total initial Web 1K payload: **19,091,922 bytes** (18.21 MiB), within the 25 MiB budget. This includes the preloaded Tree Small 02 LOD2 GLB; its raw source geometry remains outside the browser build. Aetheria retains deterministic instancing and a small stylized fallback canopy for distant trees rather than cloning raw hero meshes per tile.

`validateAssetManifest` requires a real slug/source URL, CC0 license, attribution, SHA-256 checksums, all three LOD entries, file sizes, deterministic variants, fallback and runtime budget. Game runtime never requests Poly Haven's API or CDN; releases serve the local packed files only.

## Desktop 2K / 4K hand-off

The same reviewed curation list is materialized in this checkout, but remains Git-ignored and excluded from the web build:

| Pack | Source bytes | Verified runtime bytes | Manifest entries | Local staging path |
| --- | ---: | ---: | ---: | --- |
| `web-1k` | 128,742,958 | 20,361,950 total packaged / 19,091,922 initial | 13 | `public/assets/polyhaven/web-1k/` |
| `desktop-2k` | 225,311,198 | 74,833,679 | 13 | `desktop-packs/polyhaven/desktop-2k/` |
| `desktop-4k` | 561,057,413 | 328,222,796 | 14 | `desktop-packs/polyhaven/desktop-4k/` |

Run `npm.cmd run assets:verify -- --pack desktop-2k` or `npm.cmd run assets:verify -- --pack desktop-4k` to re-hash each material manifest/file set, plus `npm.cmd run assets:verify:tree -- --pack desktop-2k` or `desktop-4k` for Tree Small 02. The chosen desktop wrapper/CDN must expose a pack at `/assets/polyhaven/<pack>/manifest.json` (or configure `VITE_AETHERIA_DESKTOP_PACK_ROOT`). The Web Demo does not discover, bundle, preload, or select either desktop directory. If a requested desktop manifest is absent, corrupt, unavailable, or unsupported, the renderer selects the local Web 1K pack; it never blocks simulation.
