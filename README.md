# khacdau-client

Web cho **đại lý** của Khắc Dấu Tâm Tín: đăng nhập bằng tài khoản riêng, nhập mã số thuế (tối đa 10 công ty),
kiểm tra thông tin doanh nghiệp, điền **Thông tin ủy quyền và nhận bàn giao** rồi tải **Đơn đề nghị khắc dấu**
(file Word `.docx`) về in, ký, gửi về Tâm Tín.

- React 18 + Vite + TypeScript, không cần backend riêng.
- Gọi API của hệ thống quản lý (`/client-portal/*` trên backend NestJS). Token đại lý tách riêng,
  **không** dùng được cho API nội bộ.
- File Word được tạo ngay trên trình duyệt (`src/lib/khacDauDoc.ts`, giống bản trong web nội bộ).

## Tài khoản đại lý

Admin tạo / khóa / đổi mật khẩu tại web nội bộ: **Cài đặt → Tài khoản đại lý**.

## Chạy trên máy

```bash
npm install
cp .env.example .env.local   # sửa VITE_API_URL nếu cần
npm run dev
```

## Deploy Cloudflare Pages

Kết nối repo này trong Cloudflare Pages với cấu hình:

| Mục | Giá trị |
|---|---|
| Framework preset | `Vite` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `VITE_API_URL=https://khacdauapi.tamtin.id.vn` |
| Node version | `20` (đã có file `.nvmrc`) |

Backend chỉ cho phép CORS từ `https://khacdautamtin.pages.dev` (và các bản preview `*.khacdautamtin.pages.dev`).
Nếu đổi sang domain khác, thêm domain đó vào biến `CORS_ORIGINS` của backend.
