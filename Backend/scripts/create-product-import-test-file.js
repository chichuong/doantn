import ExcelJS from 'exceljs';

const output = new URL('../templates/products-import-test.xlsx', import.meta.url);
const workbook = new ExcelJS.Workbook();
workbook.creator = 'Karat Retail';
workbook.created = new Date();

const worksheet = workbook.addWorksheet('products');
worksheet.columns = [
  { header: 'sku', key: 'sku', width: 22 },
  { header: 'barcode', key: 'barcode', width: 18 },
  { header: 'name', key: 'name', width: 34 },
  { header: 'description', key: 'description', width: 42 },
  { header: 'category', key: 'category', width: 24 },
  { header: 'cost_price', key: 'cost_price', width: 14 },
  { header: 'sale_price', key: 'sale_price', width: 14 },
  { header: 'reorder_level', key: 'reorder_level', width: 16 },
  { header: 'is_active', key: 'is_active', width: 12 }
];

worksheet.addRows([
  { sku: 'IMP-DEMO-BINH-001', barcode: '8938500001001', name: 'Bình giữ nhiệt inox 500ml', description: 'Bình giữ nhiệt inox, dung tích 500ml', category: 'Do gia dung', cost_price: 120000, sale_price: 179000, reorder_level: 10, is_active: true },
  { sku: 'IMP-DEMO-LY-001', barcode: '8938500001002', name: 'Bộ 6 ly thủy tinh 300ml', description: 'Bộ sáu ly thủy tinh dùng trong gia đình', category: 'Do gia dung', cost_price: 90000, sale_price: 139000, reorder_level: 8, is_active: true },
  { sku: 'IMP-DEMO-CAFE-001', barcode: '8938500001003', name: 'Cà phê rang xay Arabica 250g', description: 'Cà phê Arabica rang vừa, đóng gói 250g', category: 'Thuc pham dong goi', cost_price: 85000, sale_price: 125000, reorder_level: 15, is_active: true },
  { sku: 'IMP-DEMO-TRA-001', barcode: '8938500001004', name: 'Trà ô long túi lọc hộp 20 gói', description: 'Trà ô long dạng túi lọc, hộp 20 gói', category: 'Do uong', cost_price: 45000, sale_price: 69000, reorder_level: 20, is_active: true },
  { sku: 'IMP-DEMO-NUOC-001', barcode: '8938500001005', name: 'Nước khoáng thiên nhiên 500ml', description: 'Nước khoáng chai 500ml', category: 'Do uong', cost_price: 5000, sale_price: 8000, reorder_level: 50, is_active: true }
]);

worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
worksheet.autoFilter = 'A1:I6';
worksheet.views = [{ state: 'frozen', ySplit: 1 }];

await workbook.xlsx.writeFile(output);
console.log(`Created ${output.pathname}`);
