# Aetheria: World Shaper

Aetheria là sandbox/god-simulator 3D deterministic dùng React, Vite và Three.js. Người chơi tạo địa hình, dẫn cư dân, quản lý thời tiết và đọc biên niên sử procedural của một thế giới theo seed.

## Routes và bản phát hành

- `/` là landing page nhẹ, có thể cuộn/đọc bằng bàn phím và không tải Three.js.
- `/play` lazy-load web demo sau khi người chơi chọn “Chơi thử”. Game vẫn dùng fullscreen canvas, HUD và drawer riêng.
- Web demo bị giới hạn theo hợp đồng ở `web-1k`; nếu WebGL/GPU yếu, AssetPackManager dùng fallback 512px hoặc material procedural.
- Desktop 2K/4K selection is wired to local pack manifests and falls back safely to Web 1K when a pack is absent, corrupt, or unsupported. Cinema 8K and Patron remain “Coming soon”; there is no checkout, payment provider, recurring charge, server entitlement, or secret in this repository.

`1K / 2K / 4K / 8K` là độ phân giải texture source/asset pack — không phải độ phân giải màn hình. `renderQuality` (`auto`/`low`/`medium`/`high`) tách hoàn toàn khỏi `assetPackQuality`; chọn High không thể tự kích hoạt 8K.

## Gameplay và kỹ thuật

- World generation, ecology, objectives, council choice và simulation fixed-tick đều deterministic theo seed.
- Terrain tool có undo/redo; settlers dùng đúng tile được chọn; storm là tác động toàn cõi.
- Chronicle procedural chỉ đọc seed, tick và digest trạng thái; không có đường thay đổi gameplay.
- Renderer giữ shared geometry và `InstancedMesh` cho terrain detail, tree, rock, house, farm, road, lantern, settler và rain.
- Auto quality có FPS hysteresis/cooldown, mobile cap, DPR cap, visibility pause và `prefers-reduced-motion`.
- Renderer xuất telemetry cục bộ theo giây: FPS, draw calls, triangles, texture count và asset load duration. Đây là số so sánh trên cùng máy, không phải benchmark phần cứng chung.
- WebGL fallback, photo PNG guard, focus trap drawer, Escape, skip link và forced-colors/reduced-motion đều được giữ trong demo.

## Asset pipeline

`src/assets/` chứa manifest type, validator, registry và license copy. `src/renderer/AssetPackManager.ts` tách entitlement, capability, asset availability và fallback/disposal.

`ASSET_MANIFEST` now contains a verified 12-asset Poly Haven Web 1K material/HDRI pilot: terrain biomes, instanced tree foliage/trunks/rocks, settlement surfaces, and PMREM environment lighting. It is served entirely from local `public/assets/polyhaven/web-1k/` files (13,314,502 bytes); the browser never hotlinks Poly Haven. Procedural geometry and instancing remain intentionally in place so game readability and draw-call behavior stay stable. The ledger and offline packing commands are in [docs/ASSET_PIPELINE.md](docs/ASSET_PIPELINE.md).

Các asset Poly Haven được dùng theo CC0/public-domain. Người chơi mua game, tích hợp kỹ thuật, pack đã tối ưu và nội dung Aetheria — không mua quyền sở hữu độc quyền đối với asset nguồn.

## Chạy local

```powershell
npm.cmd install
npm.cmd run dev
```

Mở URL Vite trên HTTP loopback. Dùng `/` để kiểm tra landing và `/play` để vào demo; không dùng `file://` cho module build.

## Kiểm tra

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
git diff --check
```

Vitest bao phủ world/simulation/save, chronicle deterministic, quality, WebGL fallback, asset manifest/selection/fallback/disposal, entitlement boundary, route/landing semantic và HUD keyboard/focus primitives.

## Cấu trúc

```text
src/
├── assets/       # provenance manifest, variant selection, pack validation
├── commerce/     # entitlement/download interfaces; no live provider
├── game/         # session history, save schema, procedural chronicle
├── renderer/     # Three.js lifecycle, quality and pack resource scope
├── simulation/   # fixed-tick settlement and objectives
├── world/        # PRNG, generation and mutation commands
└── components/   # landing, HUD, drawers and viewport bridge
tools/assets/     # offline curation, hash verification; never runtime fetch
```

## Owner decisions still required

1. Distribution platform, desktop wrapper/installer and release/CDN hosting.
2. Choose desktop wrapper/installer and release/CDN placement for the already materialized 2K/4K packs; approve KTX2/BasisU build tooling before broad 2K/4K distribution.
3. Price, payment provider, merchant/legal entity, tax, refund and cancellation policy.
4. Whether Cinema is a one-time pack or subscription, plus a real recurring content cadence.
5. Patron benefits, beta process, offline/grace behavior and server-side entitlement design.
