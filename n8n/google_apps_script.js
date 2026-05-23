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
  // Process all changes (including 'OTHER' from API writes) to trigger formatting and formula replication
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
  
  // 1. Ensure formulas exist on Row 4 (self-healing)
  const d4Range = sheet.getRange("D4");
  const i4Range = sheet.getRange("I4");
  const j4Range = sheet.getRange("J4");
  
  if (!d4Range.getFormula()) {
    d4Range.setFormula('=IF(ISBLANK(K4),"",IFERROR(VLOOKUP(K4,Metadata!$A$2:$B,2,FALSE),K4))');
  }
  if (!i4Range.getFormula()) {
    i4Range.setFormula('=ROUND(F4*G4/100+H4)');
  }
  if (!j4Range.getFormula()) {
    j4Range.setFormula('=F4-I4');
  }
  
  // 2. Copy formulas for Columns D (Shop), I (Σ Back), and J (Final Price) from Row 4 down to all rows
  if (lastRow > 4) {
    d4Range.copyTo(sheet.getRange("D5:D" + lastRow), SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
    i4Range.copyTo(sheet.getRange("I5:I" + lastRow), SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
    j4Range.copyTo(sheet.getRange("J5:J" + lastRow), SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
  }
  
  // 3. Set borders on Columns A to K for all data rows (starting from Row 4)
  const dataRange = sheet.getRange(4, 1, lastRow - 3, 11); // A4:K[lastRow]
  dataRange.setBorder(
    true, true, true, true, true, true, 
    '#cccccc', 
    SpreadsheetApp.BorderStyle.SOLID
  );
  
  // 4. Sort the entire data range by the Date column (Column C) ascending
  dataRange.sort({column: 3, ascending: true});
}
