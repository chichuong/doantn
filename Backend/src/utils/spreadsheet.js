import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import path from 'node:path';

const normalizeHeader = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
const cellText = (cell) => {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'object' && cell.text !== undefined) return String(cell.text).trim();
  if (typeof cell === 'object' && cell.richText) return cell.richText.map(part => part.text).join('').trim();
  if (typeof cell === 'object' && ('formula' in cell || 'sharedFormula' in cell)) throw new Error('File nhập không được chứa công thức Excel');
  if (cell instanceof Date) return cell.toISOString();
  return String(cell).trim();
};

export const parseSpreadsheet = async (file) => {
  const workbook = new ExcelJS.Workbook();
  const extension = path.extname(file.originalname).toLowerCase();
  if (extension === '.xlsx') await workbook.xlsx.load(file.buffer);
  else await workbook.csv.read(Readable.from(file.buffer), { map: value => value });
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('File không có worksheet');
  if (worksheet.rowCount > 10001 || worksheet.columnCount > 30) throw new Error('Mỗi file tối đa 10.000 dòng dữ liệu và 30 cột');
  const headerRow = worksheet.getRow(1);
  const headers = headerRow.values.slice(1).map(normalizeHeader);
  const rows = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values = row.values.slice(1).map(cellText);
    if (values.every((value) => value === '')) continue;
    const record = { rowNumber };
    headers.forEach((header, index) => { if (header) record[header] = values[index] ?? ''; });
    rows.push(record);
  }
  return { headers, rows, extension: extension.slice(1) };
};

const headersFor = (rows) => Object.keys(rows[0] || {}).filter((key) => key !== 'rowNumber');

export const assertHeaders = (headers, required, optional = []) => {
  const missing = required.filter((header) => !headers.includes(header));
  const allowed = new Set([...required, ...optional]);
  const unknown = headers.filter((header) => !allowed.has(header));
  const errors = [];
  if (new Set(headers).size !== headers.length) errors.push('Tên cột bị trùng');
  if (missing.length) errors.push(`Thiếu cột bắt buộc: ${missing.join(', ')}`);
  if (unknown.length) errors.push(`Cột không được hỗ trợ: ${unknown.join(', ')}`);
  return errors;
};

export const rowsToSheet = (rows, format) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('data');
  const columns = rows.length ? Object.keys(rows[0]) : [];
  worksheet.columns = columns.map((key) => ({ header: key, key }));
  rows.forEach((row) => worksheet.addRow(Object.fromEntries(Object.entries(row).map(([key, value]) =>
    [key, typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value]))));
  return format === 'csv' ? workbook.csv.writeBuffer() : workbook.xlsx.writeBuffer();
};
