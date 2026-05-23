/**
 * Google Apps Script to automatically format and sort monthly sheets.
 * 
 * INSTRUCTIONS:
 * 1. Open your Google Spreadsheet.
 * 2. Go to Extensions -> Apps Script.
 * 3. Delete any default code and paste this script.
 * 4. Click Save (disk icon).
 * 5. On the left sidebar, click the Clock icon (Triggers).
 * 6. Click "+ Add Trigger" (bottom right).
 * 7. Configure:
 *    - Choose which function to run: handleSpreadsheetChange
 *    - Choose which deployment should run: Head
 *    - Select event source: From spreadsheet
 *    - Select event type: On change (this catches API insertions from n8n)
 * 8. Click Save, authorize the script if prompted.
 */

function handleSpreadsheetChange(e) {
  // Only process row insertion or cell edit events
  if (e && e.changeType !== 'INSERT_ROW' && e.changeType !== 'EDIT') {
    return;
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const sheetName = sheet.getName();
  
  // Only process monthly sheets matching YYYY-MM format
  if (!/^\d{4}-\d{2}$/.test(sheetName)) {
    return;
  }
  
  formatAndSortSheet(sheet);
}

function formatAndSortSheet(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 4) return; // No data rows yet (headers are on row 3)
  
  // 1. Copy formulas for Columns D (Shop), I (Σ Back), and J (Final Price) from Row 4 down to all rows
  if (lastRow > 4) {
    sheet.getRange("D4").copyTo(sheet.getRange("D5:D" + lastRow), SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
    sheet.getRange("I4").copyTo(sheet.getRange("I5:I" + lastRow), SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
    sheet.getRange("J4").copyTo(sheet.getRange("J5:J" + lastRow), SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
  }
  
  // 2. Set borders on Columns A to K for all data rows (starting from Row 4)
  const dataRange = sheet.getRange(4, 1, lastRow - 3, 11); // A4:K[lastRow]
  dataRange.setBorder(
    true, true, true, true, true, true, 
    '#cccccc', 
    SpreadsheetApp.BorderStyle.SOLID
  );
  
  // 3. Sort the entire data range by the Date column (Column C) ascending
  dataRange.sort({column: 3, ascending: true});
}
