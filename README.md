# Aetheria: World Shaper

Một vertical slice game web 3D sandbox god-simulator nguyên bản. Người chơi gieo một thế giới theo seed, quan sát cộng đồng đầu tiên tự phát triển và can thiệp bằng các quyền năng địa hình.

Thiết kế, tên gọi, UI, code, mô hình và âm thanh (hiện chưa có âm thanh) đều được tạo riêng cho dự án này. Game không sử dụng asset bên thứ ba, API key, dịch vụ trả phí hoặc kết nối server.

## Tính năng đã có

- Thế giới low-poly 3D sinh theo seed, cùng cấu hình tạo lại đúng cùng bản đồ.
- Điều chỉnh seed, kích thước, khí hậu, lượng nước và tài nguyên trước khi tái tạo.
- Camera isometric xoay/pan/zoom; hiển thị ngày/đêm, sương nhẹ, mây, nước và mưa lớn.
- Terrain buffer mesh có độ cao; cây, đá, tài nguyên, nhà và cư dân dùng `InstancedMesh`.
- Quyền năng: nâng/hạ đất, gọi nước, gieo rừng, làm đất màu mỡ/cằn cỗi, thả cư dân và mưa lớn.
- Preview vị trí tác động, undo/redo cho mọi chỉnh sửa địa hình.
- Một làng tự phát triển với dân số, lương thực, hạnh phúc, nhà ở, nghiên cứu, lãnh thổ và thời đại.
- Mô phỏng fixed tick deterministic, tạm dừng và tốc độ 1× / 2× / 4× / 8×.
- Biên niên sử sự kiện, Story Lens cho ô địa hình, lớp quan sát địa hình/tài nguyên/hạnh phúc và photo mode PNG.
- UI tiếng Việt responsive, điều khiển bàn phím, focus rõ ràng, `aria-live`, hỗ trợ reduced motion và high contrast.

## Chạy local

Đã kiểm chứng với Node.js `v24.15.0` trên Windows. Không cần tạo biến môi trường.

```powershell
npm.cmd install
npm.cmd run dev
```

Mở địa chỉ Vite in trong terminal (mặc định là `http://localhost:5173`). Nếu PowerShell trên máy chặn `npm.ps1`, dùng `npm.cmd` như các lệnh trên.

Các lệnh chất lượng:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

## Điều khiển

| Thao tác | Điều khiển |
| --- | --- |
| Xoay/pan camera | Kéo trên bản đồ |
| Thu phóng | Con lăn chuột hoặc pinch trackpad |
| Dùng quyền năng | Chọn công cụ rồi nhấp một ô |
| Chọn quyền năng | Phím `1` đến `8` |
| Tạm dừng / tiếp tục | `Space` hoặc nút thời gian |
| Hoàn tác | `Ctrl/Cmd + Z` |
| Làm lại | `Ctrl/Cmd + Y` |
| Chụp ảnh | Nút `⌑` trong Story Lens |

## Kiến trúc

```text
src/
├── world/
│   ├── prng.ts          # PRNG/hash thuần theo seed
│   ├── generator.ts     # Terrain, biome, village site deterministic
│   ├── commands.ts      # Command-based terrain mutations, undo/redo
│   └── types.ts         # World and tool contracts
├── simulation/
│   ├── engine.ts        # Fixed-tick village simulation and disasters
│   └── types.ts
├── renderer/
│   └── WorldRenderer.ts # Three.js ownership, camera, mesh/instances, weather
├── components/
│   ├── WorldViewport.tsx
│   ├── WorldControls.tsx
│   ├── ToolDock.tsx
│   └── SimulationPanel.tsx
├── App.tsx              # React game session, input, UI orchestration
└── styles.css            # Design tokens, responsive and accessibility styles
```

React sở hữu UI và state phiên chơi; `WorldRenderer` sở hữu canvas và vòng render Three.js. `world/` và `simulation/` không phụ thuộc React hay WebGL nên có thể kiểm thử độc lập và tái tạo deterministic. Quyết định kiến trúc cùng các đánh đổi nằm ở [ADR-001](docs/architecture/adr-001-local-deterministic-vertical-slice.md).

### Dòng dữ liệu

```text
Seed/config → world generator → World
                       ↓
Player command → command history → WorldRenderer buffer/instances
                       ↓
fixed tick → simulation engine → village stats, events, weather → React HUD + renderer
```

## Hiệu năng

- Địa hình được vẽ bằng một `BufferGeometry` có indexed vertices và vertex colors.
- Các object lặp lại dùng instancing thay vì một React component hay draw call riêng cho từng cây/cư dân.
- DPR được giới hạn ở 1 trên viewport nhỏ và 1.5 trên desktop; shadow map ở 1024px với một directional light.
- Raycast hover bị giới hạn khoảng 22 lần/giây, còn UI stats chỉ cập nhật mỗi gần một giây.
- Canvas 3D được lazy-load để UI hiển thị trước; bundle render Three.js còn khoảng 143 kB gzip trong build hiện tại.

## Kiểm thử

Vitest hiện kiểm tra:

- Sinh world giống hệt từ cùng seed/config và khác terrain khi seed thay đổi.
- Terrain command có thể undo chính xác.
- Mô phỏng cùng world/cùng số tick cho kết quả giống hệt.
- Mưa lớn được ghi nhận rồi kết thúc đúng số tick.

## Giới hạn của vertical slice

- Hiện có một làng khởi đầu; chưa có đa vương quốc, ngoại giao, chiến tranh, migration hay trade route.
- `save/load` lâu dài và chia sẻ link seed chưa được đưa vào UI; seed vẫn có thể sao chép để tái tạo đúng bản đồ.
- Heatmap hiện là lớp quan sát giản lược, chưa phải mô hình dữ liệu dân số/tài nguyên trên từng ô hoàn chỉnh.
- Chưa có âm thanh procedural, AI đa tác nhân, LOD chunking cho map rất lớn, hoặc backend/multiplayer.
- Photo mode xuất PNG local; không upload hoặc deploy bất cứ đâu.

## Hướng phát triển tiếp theo

1. Thêm save/load JSON local, seed URL và timeline có thể quay lại mốc.
2. Mở rộng sang nhiều quốc gia với territorial AI, diplomacy, caravan và combat quan sát được.
3. Nâng terrain thành chunk/LOD, profiling thực máy và setting chất lượng render.
4. Hoàn thiện heatmap, Story Lens theo cư dân/village, era architecture và accessibility audit tự động.
