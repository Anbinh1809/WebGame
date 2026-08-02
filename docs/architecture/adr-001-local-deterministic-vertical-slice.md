# ADR-001: Dùng client-side deterministic simulation và Three.js trực tiếp

## Status

Accepted

## Context

Aetheria: World Shaper là một vertical slice chơi cục bộ, không cần tài khoản, API hay dịch vụ trả phí. Bản đầu cần thế giới 3D theo seed, mô phỏng lặp lại được, camera isometric và công cụ tương tác mà vẫn nhẹ trên trình duyệt.

## Options considered

| Option | Ưu điểm | Đánh đổi |
| --- | --- | --- |
| React Three Fiber cho toàn bộ scene | Khớp React, cú pháp khai báo | Dễ tạo quá nhiều component cho tile/cư dân và thêm dependency |
| Three.js trực tiếp trong React UI | Kiểm soát vòng render, instancing rõ ràng, dependency nhỏ | Cần quản lý vòng đời canvas thủ công |
| Server simulation | Có thể mở rộng multiplayer | Không cần thiết cho bản local single-player và tăng độ phức tạp |

## Decision

React chỉ quản lý UI, lựa chọn công cụ và state game cấp cao. `WorldRenderer` sở hữu một canvas Three.js trực tiếp; terrain là một `BufferGeometry` có vertex color, cây/cư dân/tài nguyên dùng `InstancedMesh`. World generation và simulation là module TypeScript thuần, deterministic từ `seed`, tách khỏi rendering.

## Rationale

1. Đáp ứng yêu cầu React + Vite + Three.js đồng thời tránh hàng nghìn React component.
2. Cùng seed và cùng số tick tái tạo kết quả chính xác, phù hợp save/share seed về sau.
3. Giữ vertical slice không có server, secret, API key, asset bản quyền hay chi phí vận hành.

## Trade-offs

- Chưa có multiplayer, server persistence, AI đa quốc gia hay save/load hoàn chỉnh.
- Renderer cần dispose tài nguyên và event listener cẩn thận.
- Một mesh địa hình chi tiết vừa phải ưu tiên tốc độ hơn collision/physics đầy đủ.

## Revisit trigger

Xem lại khi kích thước map vượt khoảng 64×64, cần nhiều vương quốc đồng thời, hoặc cần đồng bộ multiplayer/save cloud.
