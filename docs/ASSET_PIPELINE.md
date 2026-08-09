# Aetheria asset pipeline

## Release boundary

Asset source quality is independent from render quality:

| Pack | Edition | Intended texture source | Loading rule |
| --- | --- | ---: | --- |
| `web-1k` | Web Demo | 1024px, fallback 512px | Initial game asset payload budget: <= 25 MiB; never preload desktop packs. |
| `desktop-2k` | Installed Desktop | 2048px | Load on demand only after the local 2K manifest validates. |
| `desktop-4k` | Installed Desktop | 4096px | Load only after the local 4K manifest validates; LOD, mipmaps and culling required. |
| `cinema-8k` | Desktop Cinema / Cực cao | 8192px | Explicit local load only; matching 8K PBR maps and 8K model variants, with 4K/2K/1K fallback required. |

The client is not a DRM boundary. Web is limited to the bundled 1K pack; Desktop opens 2K/4K only when their local manifests validate; Cinema 8K needs both a local pack and a server-verified paid entitlement. A production entitlement service must authorize signed, expiring download URLs server-side.

Poly Haven source assets remain CC0. Aetheria may charge for its curated Cinema distribution, installation, updates and entitlement service, but must never claim exclusive ownership of the upstream CC0 files.

## Cinema 8K entitlement hand-off

No checkout is implemented in this repository. Until an owner selects a payment and account provider, the app leaves Cinema 8K locked by default.

The approved desktop wrapper may configure `VITE_AETHERIA_ENTITLEMENT_URL` to an authenticated first-party endpoint. The endpoint must return a server-labelled status such as:

```json
{
  "state": "active",
  "source": "server",
  "entitlements": ["desktop-game", "cinema-8k"]
}
```

The browser accepts no localStorage value, query parameter, or `VITE_*` boolean as a Cinema purchase. The service must authenticate the buyer, return only authorized claims, and restrict the 8K download itself with signed, expiring URLs. A missing, malformed, demo-labelled, or unavailable response keeps the app on 4K/2K/1K.

## Manual curation flow

1. An owner selects a Poly Haven asset deliberately. Do not scrape website HTML, thumbnails or metadata.
2. Record the Poly Haven slug/source URL, `CC0-1.0` license, attribution, use case and deterministic variants in `src/assets/manifest.ts`.
3. Keep source binary outside the runtime build and do not commit a large source archive without owner approval.
4. Normalize pivot, scale, orientation and material names. Produce LOD0/LOD1/LOD2 rather than instancing a raw hero mesh.
5. Export runtime GLB/glTF as appropriate. Test geometry compression decode time and visual quality before adopting it.
6. Convert runtime texture maps to KTX2/BasisU (or a tested GPU-compressed equivalent), generate mipmaps, and verify color spaces: albedo/emissive sRGB; normal/roughness/metalness/AO linear. Tileable-material pilot assets use WebP transport plus WebGL mipmaps. The current GLB pilots preserve verified upstream JPG maps because this Windows libvips build cannot safely rewrite their packed source maps; KTX2/BasisU remains a release-gate optimization before shipping larger desktop packs.
7. Hash source and processed files with SHA-256, record bytes and validate dimensions/fallback/runtime budget.
8. Run the asset manifest validator, rendering metrics and visual review on the pilot biome before expansion.

No game runtime may hotlink Poly Haven. All release files must come from Aetheria-controlled packaging or an owner-approved CDN.

## Current license ledger

The curated Web 1K runtime binary is local at `public/assets/polyhaven/web-1k/`; raw sources stay in ignored `.asset-cache/`.

`tools/assets/reports/polyhaven-web-1k.json` carries per-file upstream and processed checksums/sizes for tileable materials. `tools/assets/reports/<asset>-<pack>.json` carries the corresponding model ledger. `npm.cmd run assets:verify` verifies materials; `npm.cmd run assets:verify:tree -- --asset <slug> --pack <pack>` verifies any packaged model GLB hash and byte count.

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
| `jacaranda_tree` | CC0-1.0 | up to four deterministic wide-canopy foreground trees, 242,652 triangles/model | 214,609,299 | 11,392,664 | `web-1k` |
| `rock_face_01` (Dario Barresi) | CC0-1.0 | instanced foreground rock formations, 20,174 triangles/model | 3,049,988 | 2,703,184 | `web-1k` |
| `cloud_layers` | CC0-1.0 | active detailed HDRI cloud sky after `/play` | 1,744,648 | 1,744,648 | `web-1k`, `desktop-2k`, `desktop-4k`, `cinema-8k` |
| `island_tree_01` | CC0-1.0 | active sparse forest tree, 41,280 triangles/model | 66,337,268 | 6,616,452 | `web-1k`, `desktop-2k`, `desktop-4k`, `cinema-8k` |
| `fern_02` | CC0-1.0 | active forest-floor ground cover, 5,210 triangles/model | 1,146,361 | 1,017,984 | `web-1k`, `desktop-2k`, `desktop-4k`, `cinema-8k` |
| `coast_rocks_05` | CC0-1.0 | active shoreline detail, 108,033 triangles/model | 25,281,108 | 3,852,388 | `web-1k`, `desktop-2k`, `desktop-4k`, `cinema-8k` |
| `boulder_01` | CC0-1.0 | active hillside boulder, 55,320 triangles/model | 5,771,986 | 3,492,516 | `web-1k`, `desktop-2k`, `desktop-4k`, `cinema-8k` |
| `thatch_roof_angled` | CC0-1.0 | primitive hut roofs after the first crafted axe | 2,727,215 | 1,062,238 | `web-1k`, deferred |
| `wooden_rough_planks` | CC0-1.0 | wood workshops after the first crafted axe | 1,411,441 | 904,196 | `web-1k`, deferred |
| `metal_plate` | CC0-1.0 | copper/iron forges after metallurgy | 2,237,747 | 769,736 | `web-1k`, deferred |
| `medieval_blocks_03` | CC0-1.0 | town halls after ironworking | 2,767,745 | 1,091,000 | `web-1k`, deferred |

Total initial Web 1K preload: **12,044,474 bytes** (11.49 MiB), within the 25 MiB budget. After `/play`, the active detailed cloud sky (**1,744,648 bytes**) and environment GLBs (**14,979,340 bytes** for the 1K tree, fern, shoreline-rock, and boulder set) load on demand. Aetheria retains deterministic instancing and procedural fallback meshes for a missing/corrupt model rather than cloning hero geometry per tile.

The four era materials are packaged at 1K/2K/4K/8K but are not part of the web initial payload. They are requested only when the settlement reaches the matching craft tier: first axe (thatch and workshop wood), metallurgy (metalwork), then ironworking (stonework). The pack verifier still hashes every deferred file; it applies the Web budget only to `runtimeBudget.preload: true` entries.

`tree_small_02` by Rico Cilliers remains in the separately staged desktop model ledger for a future close-up/photo-mode path. The active renderer prefers Island Tree, Boulder, Fern, and Coast Rocks when their local model ledgers are available; Jacaranda and Rock Face remain valid local fallbacks for older staged packs.

`validateAssetManifest` requires a real slug/source URL, CC0 license, attribution, SHA-256 checksums, all three LOD entries, file sizes, deterministic variants, fallback and runtime budget. Game runtime never requests Poly Haven's API or CDN; releases serve the local packed files only.

## Desktop 2K / 4K / 8K hand-off

The reviewed curation list is generated locally into Git-ignored desktop packs; only the Web 1K pack is part of the browser build. This keeps normal play small while making the exact same art direction available at higher source resolutions.

| Pack | Build command | Local staging path | Runtime policy |
| --- | --- | --- | --- |
| `desktop-2k` | `npm.cmd run assets:polyhaven:desktop-2k` then `npm.cmd run assets:environment:desktop-2k` | `desktop-packs/polyhaven/desktop-2k/` | Opens after the desktop build can validate its local manifest. |
| `desktop-4k` | `npm.cmd run assets:polyhaven:desktop-4k` then `npm.cmd run assets:environment:desktop-4k` | `desktop-packs/polyhaven/desktop-4k/` | Opens after the desktop build can validate its local manifest; use LOD and culling. |
| `cinema-8k` | `npm.cmd run assets:polyhaven:cinema-8k` then `npm.cmd run assets:environment:cinema-8k` | `desktop-packs/polyhaven/cinema-8k/` | Explicit Cực cao choice only; all 8K PBR maps and matching environment-model variants stay local after a valid entitlement. |

The current verified material/HDRI pack sizes are 18,886,320 bytes (`web-1k`, including deferred maps and Cloud Layers), 74,411,653 bytes (`desktop-2k`), 267,443,784 bytes (`desktop-4k`), and 906,447,263 bytes (`cinema-8k`). The four active environment GLBs add 14,979,340 bytes (1K), 47,398,340 bytes (2K), 158,250,436 bytes (4K), and 535,883,856 bytes (8K); only one selected pack is loaded at a time.

Run `npm.cmd run assets:verify -- --pack <pack>` for any material pack, including `cinema-8k`; it re-hashes every manifest/file pair. Run `npm.cmd run assets:verify:tree -- --asset <slug> --pack <pack>` for one model ledger, or `npm.cmd run assets:verify:environment -- --pack <pack>` for all four active environment models. `npm.cmd run dev:desktop` and `npm.cmd run preview:desktop` mount the local `desktop-packs/polyhaven/` staging directory at `/assets/polyhaven/` only in desktop mode, so 2K/4K can be inspected locally without copying them into the Web Demo. The chosen production desktop wrapper/CDN must expose the same URL contract (or configure `VITE_AETHERIA_DESKTOP_PACK_ROOT`). The Web Demo does not discover, bundle, preload, or select desktop directories. Desktop selectors enable 2K/4K only after that manifest validates. Cinema 8K is never unlocked merely because an 8K directory exists: the desktop wrapper must first obtain a server-verified paid `desktop-game` plus `cinema-8k` entitlement, then make the authorized local bundle available. If a requested desktop manifest is absent, corrupt, unavailable, unentitled, or unsupported, the renderer selects the local Web 1K pack; it never blocks simulation.
