# Admin/Auth API

## 1. Khoi tao database

Trong pgAdmin Query Tool, chon dung database co ten trong `DB_NAME` cua file `.env`, sau do chay toan bo file:

`database/migrations/001_admin_auth.sql`

Tai khoan seed:

- Email: `admin@example.com`
- Mat khau: `Admin@123`

Doi mat khau seed ngay khi dua len moi truong that.

## 2. Chay server

```powershell
npm run db:check
npm run dev
```

Base URL: `http://localhost:3000/api/v1`

## 3. Dang nhap

```powershell
curl.exe -X POST http://localhost:3000/api/v1/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"admin@example.com","password":"Admin@123"}'
```

Lay gia tri `data.accessToken` trong response va gan vao bien PowerShell:

```powershell
$token = "DAN_ACCESS_TOKEN_VAO_DAY"
$headers = @{ Authorization = "Bearer $token" }
```

## 4. API bao ve

### Xem tai khoan dang dang nhap

```powershell
curl.exe http://localhost:3000/api/v1/auth/me -H "Authorization: Bearer $token"
```

### Xem danh sach tai khoan

```powershell
curl.exe "http://localhost:3000/api/v1/auth/users?page=1&limit=20&search=admin&status=active" -H "Authorization: Bearer $token"
```

### Xem danh sach role

```powershell
curl.exe http://localhost:3000/api/v1/auth/roles -H "Authorization: Bearer $token"
```

### Xem danh sach permission

```powershell
curl.exe http://localhost:3000/api/v1/auth/permissions -H "Authorization: Bearer $token"
```

### Tao role

```powershell
curl.exe -X POST http://localhost:3000/api/v1/auth/roles `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d '{"code":"inventory_supervisor","name":"Giam sat kho","description":"Quan ly nghiep vu kho"}'
```

### Tao tai khoan

Lay `id` cua role tu API `GET /auth/roles`, sau do thay UUID vao request:

```powershell
curl.exe -X POST http://localhost:3000/api/v1/auth/users `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d '{"email":"manager@example.com","password":"Manager@123","fullName":"Nguyen Van Manager","phone":"0900000000","roleId":"ROLE_UUID"}'
```

### Cap nhat tai khoan

```powershell
curl.exe -X PATCH http://localhost:3000/api/v1/auth/users/USER_UUID `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d '{"status":"inactive","fullName":"Nguyen Van Manager Updated"}'
```

Khong the tu vo hieu hoa tai khoan dang dang nhap.

### Gan permission cho role

Lay cac `id` tu API `GET /auth/permissions`, sau do gui mang UUID:

```powershell
curl.exe -X PUT http://localhost:3000/api/v1/auth/roles/ROLE_UUID/permissions `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d '{"permissionIds":["PERMISSION_UUID_1","PERMISSION_UUID_2"]}'
```

### Cap nhat ten/mo ta role

```powershell
curl.exe -X PATCH http://localhost:3000/api/v1/auth/roles/ROLE_UUID `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d '{"name":"Quan ly kho cap cao","description":"Quyen quan ly kho cap cao"}'
```

## 5. Ma loi

- `400`: request body, UUID, email, status hoac du lieu dau vao khong hop le.
- `401`: thieu, sai hoac het han JWT; sai thong tin dang nhap.
- `403`: tai khoan khong co permission hoac dang bi khoa/vo hieu hoa.
- `404`: khong tim thay user/role.
- `409`: email hoac role code da ton tai.
- `500`: loi cau hinh JWT/database hoac loi server.

Moi response loi co dang:

```json
{
  "success": false,
  "message": "Noi dung loi"
}
```
