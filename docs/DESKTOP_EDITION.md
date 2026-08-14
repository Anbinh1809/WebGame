# Hướng Dẫn Bản Cài Đặt Desktop - Aetheria: World Shaper (Desktop Edition)

Tài liệu hướng dẫn đóng gói và triển khai phiên bản phần mềm tải về (Desktop Standalone App) cho người chơi.

---

## 1. Tổng Quan Phiên Bản Desktop
Phiên bản Desktop mang đến trải nghiệm thượng đỉnh với các đặc quyền độc quyền:
- **Đồ họa siêu phân giải:** Hỗ trợ texture & model 3D `2K`, `4K` và Cinema `8K` cục bộ không độ trễ.
- **Offline 100%:** Toàn bộ engine mô phỏng, thuật toán bản đồ, và hệ cơ sở dữ liệu IndexedDB chạy độc lập không cần internet.
- **Mượt mà tối đa:** Tối ưu hóa GPU render đa luồng, hỗ trợ tần số quét màn hình cao (120Hz / 144Hz / 240Hz).
- **Hệ thống Quái vật & Đấu trường Lục Địa:** Tích hợp đầy đủ các quái vật mới (`Mộc Quái Treant`, `Dực Long Frost Wyvern`), 4 nhánh tiến hóa văn minh, và đấu trường xếp hạng `Xếp Hạng Lục Địa`.

---

## 2. Cách Khởi Chạy Bản Desktop Trong Môi Trường Phát Triển

```bash
# Khởi chạy dev server ở chế độ Desktop
npm run dev:desktop

# Build bản bundle Desktop
npm run build:desktop

# Xem trước bản build Desktop cục bộ
npm run preview:desktop
```

---

## 3. Đóng Gói Thành Bộ Cài Đặt Standalone (.exe / .msi / .dmg / .deb)

### Tùy chọn A: Sử dụng Tauri (Khuyên dùng - Hiệu năng cao & Dung lượng nhẹ < 15MB)
1. Cài đặt Tauri CLI:
   ```bash
   npm install --save-dev @tauri-apps/cli
   ```
2. Khởi tạo cấu hình Tauri:
   ```bash
   npx tauri init
   ```
   - *App name:* `Aetheria - World Shaper`
   - *Window title:* `Aetheria: Kiến Tạo Thế Giới`
   - *Web assets location:* `../dist`
   - *Dev server URL:* `http://localhost:5173`
3. Đóng gói bộ cài đặt:
   ```bash
   npx tauri build
   ```
   *File installer sẽ nằm trong `src-tauri/target/release/bundle/`.*

---

### Tùy chọn B: Sử dụng Electron Forge
1. Cài đặt Electron:
   ```bash
   npm install --save-dev electron
   ```
2. Chạy lệnh build:
   ```bash
   npm run build:desktop
   npx electron .
   ```

---

## 4. Tích Hợp Gói Đồ Họa Cục Bộ (Desktop Asset Packs)
Tải hoặc sinh các gói tài nguyên đồ họa độ nét cao:
- **Gói 2K:** `npm run assets:polyhaven:desktop-2k`
- **Gói 4K:** `npm run assets:polyhaven:desktop-4k`
- **Gói Cinema 8K:** `npm run assets:polyhaven:cinema-8k`

Sau khi sinh, các gói tài nguyên sẽ được đặt trong thư mục `desktop-packs/` để game tự động nhận diện và kích hoạt.
