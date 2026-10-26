# Backend - He thong ban hang da kenh

## Phien ban code bo sung theo priority

Tien do va quy tac moi xem [implementation-progress.md](docs/implementation-progress.md).
Phien ban nay can migration 001–017. Migration 017 dam bao trang thai hien tai cua moi order co moc `order_status_history` tuong ung.
Truoc 010, chay bao cao doc du lieu `database/010_inventory_preflight.sql`; khong tu reset ton kho neu co sai lech.
Truoc 016, lam theo [migration-016-pgadmin-runbook.md](docs/migration-016-pgadmin-runbook.md) va chay pre-check/backfill/acceptance tuong ung.
Sau 014, Admin can phan cong kho cho nhan vien truoc khi dung POS/Warehouse/Order Processor.

Tai lieu OpenAPI: [openapi.json](docs/openapi.json), API `GET /api/v1/openapi.json`, trang tra cuu `/docs`.
Sinh lai bang `npm run docs:generate`. Module Python xem [Forecasting README](../Forecasting/README.md).
Thanh toan hien dung QR chuyen khoan rieng va doi soat thu cong; chua chon cong thanh toan.
Kiem thu API/database va huan luyen mo hinh de giai doan sau theo yeu cau hien tai.

## Yeu cau

- Node.js 20+
- PostgreSQL 14+
- pgAdmin 4 (cong cu quan tri, khong thay the PostgreSQL Server)

## Cai dat

```powershell
cd Backend
npm install
Copy-Item .env.example .env
```

Mo `.env`, dien mat khau PostgreSQL va ten database. Tao database trong pgAdmin:

1. Ket noi toi PostgreSQL Server (thuong `localhost:5432`).
2. Chuot phai `Databases` -> `Create` -> `Database`.
3. Dat ten `omnichannel_retail` (hoac ten trung voi `DB_NAME`).
4. Chay kiem tra:

```powershell
npm run db:check
```

Neu hien `PostgreSQL connection: OK` la pool da ket noi thanh cong.

## Khoi tao module Admin/Auth

Trong pgAdmin Query Tool, mo dung database co ten trong `DB_NAME` cua `.env` va chay toan bo file:

`database/migrations/001_admin_auth.sql`

File nay tao bang roles, permissions, users, role_permissions, audit_logs va seed tai khoan Admin.
Chi tiet endpoint va request mau xem [docs/admin-auth-api.md](docs/admin-auth-api.md).

Migration nghiep vu Manager nam tai `database/migrations/002_manager_operations.sql`, bao gom san pham,
kho, ton kho, giao dich kho, don hang, dashboard va bao cao. Payload Postman xem [docs/manager-api.md](docs/manager-api.md).

Migration nghiep vu Warehouse nam tai `database/migrations/003_warehouse_operations.sql`, bao gom chung tu
nhap/xuat kho, hoan tat cap nhat ton, quet ma va dong goi don hang. Payload Postman xem [docs/warehouse-api.md](docs/warehouse-api.md).

Migration nghiep vu POS nam tai `database/migrations/004_pos_operations.sql`, bao gom ca ban hang,
thanh toan, lap don tai quay, tru/hoan ton va huy giao dich. Payload Postman xem [docs/pos-api.md](docs/pos-api.md).

Migration nghiep vu Customer nam tai `database/migrations/005_customer_operations.sql`, bao gom catalog,
dia chi, gio hang, checkout, giu ton, lich su trang thai va huy don. Payload Postman xem [docs/customer-api.md](docs/customer-api.md).

Migration nghiep vu Shipping nam tai `database/migrations/006_shipping_operations.sql`, bao gom van don,
phan cong shipper, cap nhat trang thai va lich su giao nhan. Payload Postman xem [docs/shipping-api.md](docs/shipping-api.md).

Migration Forecasting nam tai `database/migrations/007_forecasting_operations.sql`, bao gom forecast run,
ket qua theo ngay, MAE/RMSE va canh bao thieu hang. Payload Postman xem [docs/forecasting-api.md](docs/forecasting-api.md).

Migration Order Processing nam tai `database/migrations/008_order_processing_operations.sql`, bao gom tiep nhan,
xac nhan, phan cong va cap nhat tac vu xu ly don truoc khi ban giao kho. Payload Postman xem [docs/order-processing-api.md](docs/order-processing-api.md).

Module Import/Export nam tai `database/migrations/009_data_exchange_operations.sql`, ho tro Excel/CSV cho
san pham va ton kho, export san pham/ton kho/don hang, validation theo dong va rollback transaction. Huong dan xem [docs/data-exchange-api.md](docs/data-exchange-api.md).

## Chay API

```powershell
npm run dev
```

Kiem tra `GET http://localhost:3000/api/v1/health`. Endpoint nay thuc hien `SELECT NOW()` nen dong thoi kiem tra API va database.

## Cau truc hien tai

```text
Backend/
  docs/system-analysis.md
  docs/admin-auth-api.md
  docs/manager-api.md
  docs/warehouse-api.md
  docs/pos-api.md
  docs/customer-api.md
  docs/shipping-api.md
  docs/forecasting-api.md
  docs/order-processing-api.md
  docs/data-exchange-api.md
  templates/products.csv
  templates/products.xlsx
  templates/inventory.csv
  templates/inventory.xlsx
  database/migrations/001_admin_auth.sql
  database/migrations/002_manager_operations.sql
  database/migrations/003_warehouse_operations.sql
  database/migrations/004_pos_operations.sql
  database/migrations/005_customer_operations.sql
  database/migrations/006_shipping_operations.sql
  database/migrations/007_forecasting_operations.sql
  database/migrations/008_order_processing_operations.sql
  database/migrations/009_data_exchange_operations.sql
  scripts/check-db.js
  src/
    config/              # env va PostgreSQL pool
    controllers/         # dieu phoi HTTP
    middlewares/         # error, auth, validation (bo sung dan)
    routes/              # tuyen API theo module
    services/            # quy tac nghiep vu
    models/              # schema/repository se bo sung cung migration
    app.js
    server.js
  .env.example
  package.json
```

Chi tiet actors, module va roadmap nam trong `docs/system-analysis.md`.
