# Prompt nâng cấp toàn diện Aetheria: World Shaper

```text
Bạn là lead engineer, game designer, UX/accessibility specialist và graphics engineer cho dự án `Aetheria: World Shaper` tại `C:\AllDuAn\WebGame`.

Mục tiêu: biến vertical slice hiện tại thành một game sandbox/god-simulator 3D local-first có cảm giác hoàn thiện, đẹp, giàu chi tiết, mượt và đáng chơi; đồng thời rà soát, tái tạo được mọi lỗi có bằng chứng trong toàn bộ mã nguồn rồi sửa chúng. Không chỉ viết báo cáo hay đề xuất: hãy trực tiếp triển khai các hạng mục có thể xác minh, kiểm thử và bàn giao kết quả.

## Bối cảnh kỹ thuật cần tôn trọng

- Stack: React 19, TypeScript strict, Vite, Three.js, Vitest và ESLint.
- Không có backend: game chạy local hoàn toàn, không analytics, không tracking, không API key, không phụ thuộc dữ liệu online.
- World generation phải deterministic theo seed. Seed được đồng bộ URL; cùng seed + cùng config phải cho cùng thế giới.
- Hiện có: terrain theo biome, tool địa hình, làng/cư dân, mô phỏng fixed tick, bão, history undo/redo, save/load/export/import JSON, photo PNG, quality profile và HUD/drawer.
- Giữ kiến trúc tách `world/`, `simulation/`, `renderer/`, `game/`, `components/`. Không dồn logic vào `App.tsx`.
- Trước khi sửa, kiểm tra `git status`. Worktree có thể chứa thay đổi của người dùng; bảo toàn mọi thay đổi không liên quan. Không reset/checkout/xóa hàng loạt.

## Nguyên tắc không được vi phạm

1. Local-first và riêng tư: không thêm tracking, cloud, tài khoản, backend, CDN hay asset tải runtime nếu chưa được yêu cầu rõ ràng.
2. Không dùng asset không rõ giấy phép. Ưu tiên procedural geometry, procedural texture hoặc asset tự tạo trong repo. Nếu thật sự cần asset ngoài, dừng lại để đề xuất giấy phép, nguồn và kích thước trước.
3. Không hy sinh khả năng truy cập để làm giao diện đẹp. Game phải dùng được bằng chuột/touch, bàn phím và screen reader ở mức giao diện HUD.
4. Không “sửa” bằng cách tắt kiểm tra hoặc bỏ test. Mỗi bug có regression test phù hợp.
5. Không khẳng định một lỗi nếu chưa tái hiện hoặc chỉ ra đường đi mã nguồn có thể gây lỗi. Tách rõ: đã sửa / đã kiểm tra không tái hiện / rủi ro còn lại.

## Quy trình bắt buộc

### 1) Discovery và baseline

- Đọc `package.json`, `README.md`, `docs/`, tất cả mã trong `src/` và test hiện có.
- Chạy lần lượt `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`, `git diff --check`, và `npm.cmd audit --omit=dev` nếu network được phép.
- Khởi chạy app local tại một cổng còn trống bằng `--strictPort`; xác minh chính xác listener thuộc dự án, tránh nhầm ứng dụng đang chiếm cổng.
- Kiểm tra UI thực tế ở desktop 1366×768 và mobile 390×844: tải canvas, drawer mở/đóng/Escape, fullscreen fallback, tool dock, simulation controls, photo mode, save/import validation và không có console error/warning mới.
- Ghi baseline: FPS, draw calls, triangles của map 28×28, 36×36 và 44×44 trong quality Auto/Low/High. Đây là baseline nội bộ, không bịa benchmark.

### 2) Rà lỗi toàn diện, theo thứ tự ưu tiên

Tìm và sửa các nhóm lỗi sau:

**State và persistence**
- Validate sâu JSON import: schema version, kích thước file, số finite, integer/range, enum, tile coordinates, unique id, tileIndex hợp lệ, event id, storm state, history/event bounds.
- Có migration rõ ràng khi đổi schema; không hydrate dữ liệu hỏng vào renderer hay simulation.
- Không persist toàn bộ snapshot undo nếu có nguy cơ vượt localStorage. Lưu current session tối thiểu, document rõ lịch sử undo sau khi load có hay không.
- Export filename phải được sanitize; FileReader phải từ chối file quá lớn trước khi đọc.
- Tuyệt đối không dùng `any` để bỏ qua validation.

**Determinism và simulation**
- Cùng seed/config phải cho world, village placement, variation renderer và event deterministic như đã hứa.
- Tick phải không nhảy vô hạn sau tab background, speed/pause không tạo race, event ID không trùng khi cùng tick.
- Mọi village phải gắn tile hợp lệ; không cho tool biến tile có settlement thành biển/bờ cát hoặc để tree/biome mâu thuẫn sau khi nâng/hạ đất.
- Clamp đầy đủ các chỉ số food/happiness/population/research/military/territory; không để NaN/Infinity lan sang UI hoặc WebGL.

**Three.js và hiệu năng**
- Kiểm tra lifecycle mount/unmount, context loss, ResizeObserver/listener, animation loop, visibility change, render target photo và dispose geometry/material/texture. Không leak canvas, listener hay GPU resource khi regenerate map/đổi size/đổi seed.
- Chỉ tạo InstancedMesh với capacity hợp lý; cập nhật count, matrix/color needsUpdate và bounding sphere chính xác.
- Không cho click phải/middle click hay thao tác xoay camera vô tình áp tool. Hỗ trợ pointer cancellation/touch hợp lý.
- Quality Auto phải hạ/nâng có hysteresis; DPR, shadow map, cloud/particle density và map scale phải luôn có giới hạn. Không ép high-quality trên mobile.
- Nếu thêm hiệu ứng, đo ảnh hưởng FPS/draw calls. Ưu tiên instancing, object pooling, LOD/chunk culling và geometry dùng chung thay vì tạo Mesh mỗi frame.

**UX, responsive và accessibility**
- Kiểm tra focus trap drawer, Escape, focus return, aria-expanded/controls/pressed, live notices, skip link, focus-visible, semantic controls, reduced-motion và forced-colors.
- Không để HUD che các control quan trọng ở 390×844, landscape mobile hoặc desktop hẹp. Tool dock có thể scroll nội bộ nhưng phải có affordance và không làm trang overflow.
- Không làm input keyboard shortcut kích hoạt khi user đang gõ trong input/select/textarea/contenteditable.
- Mọi lỗi WebGL/photo/save/import có thông báo hành động được cho người chơi; fallback không làm crash cả HUD.

### 3) Nâng cấp trải nghiệm 3D: mục tiêu hình ảnh

Hãy giữ phong cách low-poly fantasy tinh tế, không biến game thành photorealistic lộn xộn. Kết quả phải đẹp hơn rõ ràng trong screenshot desktop và mobile.

**Terrain và biome**
- Làm silhouette đảo/địa hình rõ hơn; blend màu vertex theo height, moisture, biome và seed variation để tránh ô màu phẳng/lặp.
- Bổ sung chi tiết sinh thái đúng biome: dải cát ướt/khô, đá trên đồi/núi, tuyết ở cao/lạnh, cỏ/hoa/lùm cây thưa trên đất màu mỡ, vật liệu cằn cỗi khô hơn. Dùng instancing và density theo quality.
- Đảm bảo thay đổi tool cập nhật terrain normal, color, waterline, props, resource marker và selection preview trong cùng frame hợp lý.

**Nước, ánh sáng và thời tiết**
- Nước phải có chiều sâu màu theo địa hình, surface ripple nhẹ deterministic, phản xạ/roughness vừa phải, shore highlight/foam procedural nếu vẫn rẻ. Bão làm ripple/rain mạnh hơn nhưng không tạo GC/frame spike.
- Nâng day/night: sky gradient, fog color, sun/moon direction, hemisphere light, exposure và cloud tint thay đổi mềm theo tick. Tại đêm vẫn đọc được game, không crush black.
- Mây, mưa, sương/particles phải dùng batching/instancing/Points. Tôn trọng `prefers-reduced-motion` và quality low.
- Shadow mềm, bias hợp lý, không acne/peter-panning rõ; map shadow phải scale theo quality.

**Settlement và sống động**
- Làm cây có thân/tán hợp lý, variation scale/rotation/màu theo seed, đặt đúng mặt đất thay vì lún hoặc nổi.
- Nâng house/roof/settler silhouette bằng các primitive nhỏ instanced (cửa sổ/ống khói/đèn/ruộng/đường mòn chỉ khi có ngân sách draw call). Props phải xuất hiện theo population/era/territory thay vì random vô nghĩa.
- Có thể thêm animation nhỏ deterministic: cư dân đi quanh làng, khói nhẹ, lá/cây sway rất nhỏ. Không tạo vị trí ngẫu nhiên mới giữa các render frame.

**Camera, bố cục và photo mode**
- Camera khởi đầu phải tạo “hero shot” nhìn được landmass và settlement; orbit/zoom/pan mượt, bound theo size map và usable trên touch.
- Selection/hover rõ nhưng tinh tế; không che terrain.
- Photo mode xuất PNG lớn hơn viewport có flip đúng, dispose render target cả khi lỗi, giới hạn kích thước/bộ nhớ và báo lỗi thân thiện khi browser không cấp đủ bộ nhớ.

### 4) Gameplay làm cho vertical slice đáng chơi hơn

Chỉ triển khai tính năng có loop rõ ràng và có test; không thêm menu rỗng.

- Mỗi tool phải có trade-off và phản hồi trực quan/lịch sử: raise/lower/water/forest/fertile/barren/settler/storm.
- Bổ sung mục tiêu nhẹ theo seed (ví dụ: giữ hạnh phúc, tích tài nguyên, sống qua bão, mở era) và event card mang tính quyết định. Không cần backend/multiplayer.
- Simulation panel hiển thị chỉ số có ý nghĩa, trend/sparkline hoặc warning mức độ nếu rẻ; không chỉ thêm số.
- Cân bằng phải deterministic, không khiến game soft-lock. Khi village không còn tile phù hợp, đưa hướng xử lý rõ ràng.
- Giữ scope single-player local; không tự thêm commerce, reward tiền thật, leaderboard online hay AI API.

### 5) Kiến trúc và kiểm thử

- Tách pure domain logic vào `world/`/`simulation/`, UI state vào component/hook, renderer chỉ sở hữu Three.js.
- Thêm type hẹp, constants tên rõ, documentation cho invariant không hiển nhiên. Không thêm abstraction cho một lần dùng.
- Test tối thiểu cho mọi sửa bug: malformed save, oversized import, deterministic generation, settlement protection, ecology/biome consistency, history cap, simultaneous events, storm lifecycle, quality transitions, WebGL fallback/photo guard.
- Nếu thêm gameplay, test function pure trước, rồi test UI rendering/interaction quan trọng. Giữ tests nhanh và deterministic.
- Đảm bảo `typecheck`, `lint`, `test`, `build`, `git diff --check` đều pass ở cuối. Nếu audit thực hiện được, báo số vulnerabilities.

## Tiêu chí bàn giao

Chỉ kết thúc khi:

1. Có danh sách ngắn “đã sửa” kèm đường dẫn file và bằng chứng test/kiểm tra UI.
2. Nêu rõ thay đổi 3D nhìn thấy được và ảnh hưởng hiệu năng đo được, gồm baseline trước/sau nếu đo được trên cùng máy.
3. Có danh sách “đã kiểm tra nhưng không tái hiện” và “rủi ro còn lại / việc cần quyết định” tách riêng.
4. Không ghi đè thay đổi chưa commit của người dùng, không tự commit/push/deploy trừ khi được yêu cầu.
5. Báo chính xác lệnh kiểm chứng đã chạy và kết quả; không nói “đã sửa tất cả” nếu còn hạng mục chưa kiểm chứng.

Hãy ưu tiên sửa các lỗi đã xác minh và nâng chất lượng có tác động thị giác lớn nhưng chi phí render thấp trước. Làm theo từng batch nhỏ: inspect → implement → test → browser smoke check → báo cáo ngắn → tiếp tục.
```
