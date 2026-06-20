import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createSampleExcel() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');

  sheet.addRow(['Date', 'Symbol']);
  sheet.addRow(['02 May 2013', 'RELIANCE']);
  sheet.addRow(['10 Mar 2020', 'RELIANCE']);
  sheet.addRow(['15 Jan 2021', 'TCS']);
  sheet.addRow(['01 Jun 2021', 'TCS']);
  sheet.addRow(['bad date', 'INFY']);
  sheet.addRow(['02 May 2013', 'RELIANCE']);

  const outPath = path.join(__dirname, '..', 'sample-input.xlsx');
  await workbook.xlsx.writeFile(outPath);
  console.log(`Sample Excel created: ${outPath}`);
}

createSampleExcel().catch(console.error);
