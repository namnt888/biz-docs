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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const sheetName = sheet.getName();
  
  // Only process monthly sheets matching YYYY-MM format
  if (!/^\d{4}-\d{2}$/.test(sheetName)) {
    return;
  }
  
  const lastRow = sheet.getLastRow();
  const changeType = e ? e.changeType : 'OTHER';
  
  // Prevent infinite loops on script-triggered updates (changeType === 'OTHER')
  if (changeType === 'OTHER') {
    const cache = CacheService.getScriptCache();
    const cacheKey = "formatted_" + sheetName + "_" + lastRow;
    if (cache.get(cacheKey) === "true") {
      return; // Already formatted this state, skip to prevent recursive loop
    }
    // Set cache flag before modifying sheet to block recursive onChange events
    cache.put(cacheKey, "true", 60);
  }
  
  formatAndSortSheet(sheet);
}


function formatAndSortSheet(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 4) return; // No data rows yet (headers are on row 3)
  
  // 1. Ensure array formulas exist on Row 3 (Header row) to prevent sorting issues and duplicate collisions
  const d3Range = sheet.getRange("D3");
  const i3Range = sheet.getRange("I3");
  const j3Range = sheet.getRange("J3");
  
  if (!d3Range.getFormula()) {
    d3Range.setFormula('={"Shop"; ARRAYFORMULA(IF(ISBLANK(K4:K), "", IFERROR(VLOOKUP(K4:K, Metadata!$A$2:$B, 2, FALSE), K4:K)))}');
  }
  if (!i3Range.getFormula()) {
    i3Range.setFormula('={"Σ Back"; ARRAYFORMULA(IF(ISBLANK(F4:F), "", ROUND(F4:F * G4:G / 100 + H4:H)))}');
  }
  if (!j3Range.getFormula()) {
    j3Range.setFormula('={"Final Price"; ARRAYFORMULA(IF(ISBLANK(F4:F), "", F4:F - I4:I))}');
  }
  
  // Clear any accidental formulas in Row 4 to prevent expansion blockage (#REF!)
  const d4Range = sheet.getRange("D4");
  const i4Range = sheet.getRange("I4");
  const j4Range = sheet.getRange("J4");
  if (d4Range.getFormula()) d4Range.clearContent();
  if (i4Range.getFormula()) i4Range.clearContent();
  if (j4Range.getFormula()) j4Range.clearContent();

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
