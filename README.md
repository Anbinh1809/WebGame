# Aetheria: World Shaper

Game sandbox/god-simulator 3D chạy hoàn toàn local bằng React, Vite và Three.js. Thế giới, mô phỏng và biến thể đồ họa đều xác định theo seed; không có backend, API key, analytics, tracking hay asset bên thứ ba.

## Trải nghiệm

- Canvas chiếm toàn bộ viewport; HUD, drawer và tool dock phủ trực tiếp trên game.
- Drawer Thế giới và Mô phỏng có `aria-expanded`, focus trap, nút đóng và phím `Escape`.
- Fullscreen API có đồng bộ trạng thái và CSS fallback.
- World generation deterministic theo seed; seed luôn được đồng bộ vào URL (`?seed=...`).
- Tool terrain có undo/redo snapshot an toàn qua cả thao tác tái tạo thế giới.
- Thả cư dân dùng đúng ô đã bấm: từ chối biển/bờ cát, nhập vào làng gần nhất hoặc lập tiền đồn mới.
- Mưa lớn là tác động toàn cõi, có nút kích hoạt riêng thay vì giả vờ phụ thuộc ô bấm.
- Nghiên cứu, phòng vệ và lãnh thổ được hiển thị và tác động thu hoạch/thiệt hại bão.
- Lưu cục bộ, nạp, đặt lại, thế giới mới, xuất và nhập JSON với schema version + kiểm tra dữ liệu trước khi hydrate.
- Photo mode render qua `WebGLRenderTarget` sang PNG độ phân giải cao hơn drawing buffer.

## Đồ họa và hiệu năng

- Terrain vertex color có variation theo seed, normal được tính lại, bờ cát và độ sâu nước có màu chuyển tiếp.
- `MeshStandardMaterial`/`MeshPhysicalMaterial`, day/night, fog, sun/moon tint, mây procedural và mưa instanced/batched.
- Tree, rock, house và settler dùng `InstancedMesh`, scale/rotation deterministic và bounding-sphere culling.
- Quality profile: `auto`, `low` (DPR 1), `medium` (DPR 1.5), `high` (DPR 2). Auto hạ chất lượng khi FPS giảm.
- Renderer dừng animation loop khi tab ẩn, dọn listener/observer/geometry/material/render target/context khi unmount, và cập nhật DPR khi resize/zoom.
- Chunk renderer được lazy-load; Three.js tách thành vendor chunk để HUD tải trước.

Kết quả profile local ở viewport 1366×768, chất lượng Auto (máy kiểm tra):

| Bản đồ | FPS | Draw calls | Triangles |
| --- | ---: | ---: | ---: |
| 28 × 28 | 92 | 36 | 14,240 |
| 36 × 36 | 92 | 36 | 20,836 |
| 44 × 44 | 113 | 36 | 21,456 |

Các số này là chỉ báo máy cục bộ, không phải benchmark phần cứng chung.

## Chạy local

```powershell
npm.cmd install
npm.cmd run dev
```

Mở URL Vite in ra (mặc định `http://127.0.0.1:5173`).

## Phím tắt

| Hành động | Điều khiển |
| --- | --- |
| Chọn công cụ | `1`–`8` |
| Tạm dừng / tiếp tục | `Space` |
| Hoàn tác | `Ctrl/Cmd + Z` |
| Làm lại | `Ctrl/Cmd + Y` hoặc `Ctrl/Cmd + Shift + Z` |
| Đóng drawer | `Escape` |
| Camera | kéo để xoay, cuộn để zoom |

## Kiểm tra

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd audit --omit=dev
```

Vitest bao phủ world generation deterministic, simulation, unique event ID cùng tick, heatmap theo tọa độ x/z, cư dân hợp lệ/không hợp lệ, mưa toàn cõi, history undo/redo/revision, save/load/corrupt save, quality profiles, WebGL fallback guard, PNG data URL và component HUD drawer/fullscreen.

E2E thủ công được chạy trong browser local ở 1366×768, 1920×1080, 1024×768 và 390×844: canvas chiếm toàn viewport, không overflow trang, drawer mở/đóng bằng Escape, fullscreen hoạt động, và HUD mobile giữ tool dock cuộn nội bộ.

## Cấu trúc

```text
src/
├── game/          # session snapshot history và save schema
├── world/         # PRNG, generation, mutation commands
├── simulation/    # fixed-tick engine, settlement, metrics
├── renderer/      # Three.js ownership, quality, WebGL lifecycle
└── components/    # HUD, drawers, viewport, controls
```

## Giới hạn hiện tại

- Game vẫn là single-player local; không có multiplayer, cloud save, ngoại giao hay chiến đấu.
- Bản đồ tối đa 44×44 trong UI hiện tại. Map lớn hơn nên dùng chunk/LOD terrain trước khi mở giới hạn.
- Photo PNG được kiểm tra bằng guard unit test và thao tác browser không lỗi console; hành vi download cuối cùng phụ thuộc quyền download của trình duyệt.
