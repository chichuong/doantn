import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';

const templates = {
  categories: {
    headers: ['name', 'description', 'is_active'],
    row: ['Danh muc moi', 'Mo ta danh muc', true]
  },
  products: {
    headers: ['sku', 'barcode', 'name', 'description', 'category', 'cost_price', 'sale_price', 'reorder_level', 'is_active'],
    row: ['SP-NEW-001', '8930000000999', 'San pham mau', 'Mo ta san pham mau', 'Do gia dung', 10000, 15000, 10, true]
  },
  inventory: {
    headers: ['sku', 'quantity'],
    row: ['SP-001', 100]
  }
};

await fs.mkdir(new URL('../templates/', import.meta.url), { recursive: true });
for (const [name, template] of Object.entries(templates)) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(name);
  worksheet.addRow(template.headers);
  worksheet.addRow(template.row);
  await workbook.xlsx.writeFile(new URL(`../templates/${name}.xlsx`, import.meta.url));
  await workbook.csv.writeFile(new URL(`../templates/${name}.csv`, import.meta.url));
}
console.log('Import templates created');
