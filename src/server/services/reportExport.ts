const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const ExcelJS = require('exceljs');

function csvEscape(value: unknown) {
  const text = value === undefined || value === null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    return '';
  }

  const headers = Object.keys(rows[0]);
  return [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))
  ].join('\n');
}

async function toPdf(title: string, rows: Array<Record<string, unknown>>) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [842, 595];
  let page = pdf.addPage(pageSize);
  let y = 555;

  page.drawText(title, { x: 36, y, size: 16, font: bold, color: rgb(0.05, 0.2, 0.18) });
  y -= 28;

  const headers = rows[0] ? Object.keys(rows[0]) : ['No data'];
  const lines = rows.length > 0
    ? rows.map((row) => headers.map((header) => `${header}: ${row[header] ?? ''}`).join(' | '))
    : ['No matching records.'];

  for (const line of lines) {
    if (y < 40) {
      page = pdf.addPage(pageSize);
      y = 555;
    }
    page.drawText(line.slice(0, 150), { x: 36, y, size: 9, font });
    y -= 15;
  }

  return pdf.save();
}

async function toXlsx(sheetName: string, rows: Array<Record<string, unknown>>) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31));
  const outputRows = rows.length > 0 ? rows : [{ notice: 'No matching records.' }];
  const headers = Object.keys(outputRows[0]);
  worksheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: Math.min(Math.max(header.length + 4, 14), 40)
  }));
  for (const row of outputRows) {
    worksheet.addRow(row);
  }
  worksheet.getRow(1).font = { bold: true };
  return workbook.xlsx.writeBuffer();
}

module.exports = { toCsv, toPdf, toXlsx };

export {};
