import ExcelJS from 'exceljs';

const fixtures = [
  {
    filename: '01-danh-muc-test.xlsx',
    sheet: 'Danh mục',
    columns: [
      { header: 'name', key: 'name', width: 28 },
      { header: 'description', key: 'description', width: 48 },
      { header: 'is_active', key: 'is_active', width: 16 },
    ],
    rows: [
      { name: 'Chăm sóc cá nhân', description: 'Sản phẩm chăm sóc và vệ sinh cá nhân', is_active: true },
      { name: 'Phụ kiện công nghệ', description: 'Phụ kiện dùng cho điện thoại và máy tính', is_active: true },
    ],
  },
  {
    filename: '02-san-pham-test.xlsx',
    sheet: 'Sản phẩm',
    columns: [
      { header: 'sku', key: 'sku', width: 22 },
      { header: 'barcode', key: 'barcode', width: 18 },
      { header: 'name', key: 'name', width: 34 },
      { header: 'description', key: 'description', width: 48 },
      { header: 'category', key: 'category', width: 26 },
      { header: 'cost_price', key: 'cost_price', width: 16 },
      { header: 'sale_price', key: 'sale_price', width: 16 },
      { header: 'reorder_level', key: 'reorder_level', width: 22 },
      { header: 'is_active', key: 'is_active', width: 16 },
    ],
    rows: [
      { sku: 'UAT-20261113-001', barcode: '8938500011301', name: 'Bàn chải đánh răng lông mềm', description: 'Bàn chải lông mềm dùng hằng ngày', category: 'Chăm sóc cá nhân', cost_price: 18000, sale_price: 29000, reorder_level: 20, is_active: true },
      { sku: 'UAT-20261113-002', barcode: '8938500011302', name: 'Khăn mặt cotton 34x75cm', description: 'Khăn cotton mềm, thấm hút tốt', category: 'Chăm sóc cá nhân', cost_price: 35000, sale_price: 55000, reorder_level: 15, is_active: true },
      { sku: 'UAT-20261113-003', barcode: '8938500011303', name: 'Cáp sạc USB-C dài 1 mét', description: 'Cáp sạc USB-C bọc dù', category: 'Phụ kiện công nghệ', cost_price: 45000, sale_price: 79000, reorder_level: 12, is_active: true },
      { sku: 'UAT-20261113-004', barcode: '8938500011304', name: 'Giá đỡ điện thoại để bàn', description: 'Giá đỡ gấp gọn, điều chỉnh góc nhìn', category: 'Phụ kiện công nghệ', cost_price: 52000, sale_price: 89000, reorder_level: 10, is_active: true },
    ],
  },
  {
    filename: '03-ton-kho-test.xlsx',
    sheet: 'Tồn kho',
    columns: [
      { header: 'sku', key: 'sku', width: 22 },
      { header: 'quantity', key: 'quantity', width: 20 },
    ],
    rows: [
      { sku: 'UAT-20261113-001', quantity: 120 },
      { sku: 'UAT-20261113-002', quantity: 80 },
      { sku: 'UAT-20261113-003', quantity: 60 },
      { sku: 'UAT-20261113-004', quantity: 40 },
    ],
  },
];

for (const fixture of fixtures) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Karat Retail';
  workbook.created = new Date('2026-11-13T00:00:00+07:00');
  const worksheet = workbook.addWorksheet(fixture.sheet);
  worksheet.columns = fixture.columns;
  worksheet.addRows(fixture.rows);
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = `A1:${worksheet.getColumn(fixture.columns.length).letter}${fixture.rows.length + 1}`;
  await workbook.xlsx.writeFile(new URL(`../templates/${fixture.filename}`, import.meta.url));
  console.log(`Created ${fixture.filename}`);
}
