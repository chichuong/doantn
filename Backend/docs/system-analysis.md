# Phan tich tac nhan va lo trinh Backend

## 1. Pham vi rut ra tu de cuong

He thong quan tri ban hang da kenh dung chung Backend API va PostgreSQL cho Web, ung dung Flutter, POS, kho va giao nhan. Backend la trung tam xu ly xac thuc, phan quyen, quy tac nghiep vu, dong bo ton kho, don hang va du lieu du bao.

## 2. Actors va nghiep vu

| Actor/Role | Nhom nghiep vu chinh |
|---|---|
| Quan tri vien (Admin) | Quan ly tai khoan, vai tro, phan quyen; quan ly cau hinh he thong; xem nhat ky hoat dong; quan ly danh muc, san pham, SKU va ma vach/QR. |
| Quan ly (Manager) | Xem dashboard; quan ly san pham, kho, nhap-xuat-ton, don hang, van chuyen; xem bao cao; xem canh bao thieu hang va de xuat nhap hang tu du bao. |
| Nhan vien ban hang/POS | Tim san pham, quet ma, lap don tai cua hang, ap dung gia/khuyen mai theo quy dinh, ghi nhan thanh toan, in/xem hoa don. |
| Nhan vien kho | Tiep nhan nhap kho, xuat kho; quet ma san pham; kiem dem, lay hang, kiem tra dong goi; cap nhat bien dong ton kho; nhap/xuat Excel/CSV theo quyen. |
| Nhan vien xu ly don | Tiep nhan don online; xac nhan, phan cong lay hang; kiem tra san pham, dong goi; xac nhan san sang ban giao. Co the do nhan vien kho dam nhiem trong phien ban dau. |
| Nhan vien giao hang | Nhan don duoc ban giao; quet ma van don; cap nhat dang giao, giao thanh cong, giao that bai/hoan; luu lich su giao nhan. |
| Khach hang | Dang ky/dang nhap; xem va tim san pham; quan ly gio hang; dat hang; chon thanh toan; xem lich su va theo doi trang thai don hang. |
| Dich vu du bao | Nhan du lieu ban hang; chay/tich hop mo hinh; tra ket qua du bao theo san pham va khoang thoi gian. Day la service, khong phai nguoi dung truc tiep. |
| He thong quet ma | Gui ma vach/QR cua san pham hoac van don de Backend tra cuu va xac nhan trong cac buoc nghiep vu. Day la he thong ngoai, co the tich hop qua mobile/scanner. |

## 3. Nhom module Backend de phat trien

1. `auth`: dang ky/dang nhap, JWT, tai khoan, role/permission.
2. `catalog`: danh muc, san pham, SKU, gia, ma vach/QR.
3. `inventory`: kho, nhap-xuat-ton, giao dich kho, khoa tranh tru trung ton.
4. `pos`: ban hang tai cua hang, gio hang POS, thanh toan, hoa don.
5. `orders`: don online, chi tiet don, vong doi xu ly, dong goi.
6. `shipping`: van don, ban giao, cap nhat trang thai, lich su giao nhan.
7. `imports-exports`: nhap Excel/CSV, validate, preview, export bao cao.
8. `reports`: thong ke doanh thu, don hang, ton kho.
9. `forecasting`: du lieu ban hang, goi module du bao, canh bao thieu hang, de xuat nhap.
10. `audit`: nhat ky thao tac va truy vet thay doi quan trong.

## 4. Nguyen tac kien truc

- Route chi dinh tuyen va middleware; controller nhan request/tra response; service chua quy tac nghiep vu; repository/model chua truy cap du lieu.
- Moi thay doi ton kho va trang thai don hang phai nam trong transaction PostgreSQL.
- API version dat duoi `/api/v1`.
- Khong de mat khau, JWT secret hoac chuoi ket noi that vao Git.
- Mo hinh du bao chi ho tro ra quyet dinh; khong tu dong tao lenh nhap hang.

## 5. Roadmap theo actor

### Giai doan 0 - Nen tang chung
- Tao PostgreSQL database, migration va seed role ban dau.
- Hoan thien config, logging, validation, error format va health check.
- Thong nhat response, pagination, transaction helper va quy uoc API.

### Giai doan 1 - Admin
- `auth`: dang nhap, JWT, role/permission.
- CRUD user, role, permission va khoa/mo tai khoan.
- CRUD danh muc, san pham, SKU, ma vach/QR.

### Giai doan 2 - Quan ly
- Dashboard va bao cao co ban.
- Quan ly kho, xem bien dong ton kho.
- Duyet/quan sat nhap-xuat, canh bao ton toi thieu.

### Giai doan 3 - Nhan vien kho
- Nhap kho, xuat kho, dieu chinh ton co audit.
- Tra cuu/quet ma san pham.
- Picking, packing, kiem tra hang va transaction tru ton.
- Import san pham/danh muc/ton kho tu Excel/CSV.

### Giai doan 4 - Nhan vien ban hang/POS
- Tao don tai quay, quet ma, tinh tong va thanh toan.
- Tru ton theo transaction va phat sinh doanh so.
- In/export hoa don neu pham vi can.

### Giai doan 5 - Khach hang
- Catalog public, tim kiem, gio hang.
- Tao don online, thanh toan theo phuong an duoc chon.
- Xem lich su va theo doi don hang.

### Giai doan 6 - Nhan vien xu ly don va giao hang
- Xac nhan don, phan cong, dong goi, ban giao.
- Tao van don, gan shipper.
- Shipper cap nhat trang thai va luu timeline giao nhan.

### Giai doan 7 - Du bao va bao cao
- Pipeline du lieu ban hang theo ngay/san pham.
- Tich hop forecasting service qua API.
- MAE/RMSE, ket qua du bao, canh bao thieu hang va de xuat nhap.
- Export bao cao san pham, don hang, ton kho, doanh thu.

### Giai doan 8 - Tich hop va kiem thu
- Kiem thu API, transaction va phan quyen.
- Kiem thu end-to-end tu ban hang den giao hang.
- Kiem thu import du lieu loi/trung/thieu va tai lieu API.
